/**
 * buyer.ts — Command-line buyer for the threat intel API.
 *
 * Looks up IPs one by one, paying each 402 offer the Radius Platform gate returns:
 * GET → 402 (PAYMENT-REQUIRED) → sign EIP-2612 + Permit2 → GET with PAYMENT-SIGNATURE → 200.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/buyer.ts [--base http://localhost:8787] [--network testnet]
 *                                             [--max-amount 100] <ip> [ip...]
 *
 * --max-amount is in raw SBC units (6 decimals; 100 = $0.0001). The buyer refuses any offer
 * above it. Mainnet payments are real money.
 */

import { createPublicClient, defineChain, http, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const NETWORKS = {
  testnet: { chainId: 72344, rpc: 'https://rpc.testnet.radiustech.xyz', name: 'Radius Testnet' },
  mainnet: { chainId: 723487, rpc: 'https://rpc.radiustech.xyz', name: 'Radius' },
} as const;

const SBC = '0x33ad9e4BD16B69B5BFdED37D8B5D9fF9aba014Fb' as const;
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;
const X402_PROXY = '0x402085c248EeA27D92E8b30b2C58ed07f9E20001' as const;

type Offer = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: Hex;
  maxTimeoutSeconds?: number;
  extra?: { name?: string; version?: string };
};

function parseArgs(argv: string[]) {
  const args = { base: 'http://localhost:8787', network: 'testnet' as keyof typeof NETWORKS, maxAmount: 100n, replay: false, ips: [] as string[] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--replay') args.replay = true;
    else if (a === '--base') args.base = argv[++i];
    else if (a === '--network') args.network = argv[++i] as keyof typeof NETWORKS;
    else if (a === '--max-amount') args.maxAmount = BigInt(argv[++i]);
    else args.ips.push(a);
  }
  if (!NETWORKS[args.network]) throw new Error(`--network must be testnet or mainnet`);
  if (args.ips.length === 0) throw new Error('Give at least one IP address');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.PRIVATE_KEY as Hex | undefined;
  if (!key) throw new Error('Set PRIVATE_KEY in the environment');

  const net = NETWORKS[args.network];
  const chain = defineChain({
    id: net.chainId,
    name: net.name,
    nativeCurrency: { name: 'RUSD', symbol: 'RUSD', decimals: 18 },
    rpcUrls: { default: { http: [process.env.RPC_URL ?? net.rpc] } },
  });
  const client = createPublicClient({ chain, transport: http() });
  const account = privateKeyToAccount(key);
  const sbc = parseAbi(['function nonces(address) view returns (uint256)', 'function balanceOf(address) view returns (uint256)']);

  const balance = await client.readContract({ address: SBC, abi: sbc, functionName: 'balanceOf', args: [account.address] });
  console.log(`buyer ${account.address} on ${net.name}: ${Number(balance) / 1e6} SBC`);

  for (const ip of args.ips) {
    const url = `${args.base}/api/threat/${encodeURIComponent(ip)}?network=${args.network}`;

    // 1. Unpaid request: expect a 402 with the offer.
    const res402 = await fetch(url);
    if (res402.status !== 402) {
      console.log(`${ip}: expected 402, got ${res402.status} ${await res402.text()}`);
      continue;
    }
    const header = res402.headers.get('PAYMENT-REQUIRED');
    const required = header ? JSON.parse(atob(header)) : await res402.json();
    const offer: Offer | undefined = required.accepts?.find((o: Offer) => o.network === `eip155:${net.chainId}`);
    if (!offer) throw new Error(`No offer for eip155:${net.chainId}: ${JSON.stringify(required.accepts)}`);
    if (BigInt(offer.amount) > args.maxAmount) {
      throw new Error(`Offer of ${offer.amount} exceeds --max-amount ${args.maxAmount}; not paying`);
    }

    // 2. Sign: EIP-2612 permit (lets Permit2 spend SBC) + Permit2 transfer to the offer's payTo.
    const amount = BigInt(offer.amount);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (offer.maxTimeoutSeconds ?? 60));
    const permitNonce = await client.readContract({ address: SBC, abi: sbc, functionName: 'nonces', args: [account.address] });
    const p2Nonce = BigInt('0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'));

    const eip2612Signature = await account.signTypedData({
      domain: { name: offer.extra?.name ?? 'Stable Coin', version: offer.extra?.version ?? '1', chainId: net.chainId, verifyingContract: SBC },
      types: { Permit: [
        { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
      ] },
      primaryType: 'Permit',
      message: { owner: account.address, spender: PERMIT2, value: amount, nonce: permitNonce, deadline },
    });

    const permit2Signature = await account.signTypedData({
      domain: { name: 'Permit2', chainId: net.chainId, verifyingContract: PERMIT2 },
      types: {
        PermitWitnessTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' }, { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'witness', type: 'Witness' },
        ],
        TokenPermissions: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
        Witness: [{ name: 'to', type: 'address' }, { name: 'validAfter', type: 'uint256' }],
      },
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: { token: SBC, amount }, spender: X402_PROXY, nonce: p2Nonce, deadline,
        witness: { to: offer.payTo, validAfter: 0n },
      },
    });

    const payload = {
      x402Version: 2,
      resource: required.resource,
      accepted: offer,
      payload: {
        signature: permit2Signature,
        permit2Authorization: {
          permitted: { token: SBC, amount: amount.toString() },
          from: account.address,
          spender: X402_PROXY,
          nonce: p2Nonce.toString(),
          deadline: deadline.toString(),
          witness: { to: offer.payTo, validAfter: '0' },
        },
      },
      extensions: { eip2612GasSponsoring: { info: { amount: amount.toString(), deadline: deadline.toString(), signature: eip2612Signature } } },
    };

    // 3. Paid request.
    const paymentSignature = btoa(JSON.stringify(payload));
    const t0 = Date.now();
    const res = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': paymentSignature } });
    const ms = Date.now() - t0;
    const body = await res.text();
    if (!res.ok) {
      console.log(`${ip}: HTTP ${res.status} after ${ms}ms: ${body}`);
      continue;
    }
    const data = JSON.parse(body);
    console.log(`${ip}: score ${data.threat_score}, ${data.categories.join('/')}, ${data.country} · paid ${offer.amount} raw · tx ${data.tx_hash ?? '(none)'} · ${ms}ms (verify ${data.verify_ms}ms, settle ${data.settle_ms}ms)`);

    // --replay: send the same signed payment again. The gate must refuse it (one payment, one request).
    if (args.replay) {
      const again = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': paymentSignature } });
      console.log(`${ip}: replayed the same payment → HTTP ${again.status} ${again.ok ? '(ACCEPTED — double spend!)' : '(refused, as it should be)'}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
