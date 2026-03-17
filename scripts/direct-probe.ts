/**
 * direct-probe.ts — Call facilitator /verify and /settle directly (bypassing CF Worker).
 *
 * Compares facilitator latency from your local machine vs. through the Worker
 * to quantify Cloudflare Worker network overhead.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/direct-probe.ts [iterations]
 *
 * Optional env:
 *   FACILITATOR_URL   (default: https://facilitator.andrs.dev)
 *   FACILITATOR_API_KEY
 *   PAYMENT_ADDRESS   (default: 0xDA60059faBf3e71338c27C505CED519f55d605DD)
 */

import { createPublicClient, http, defineChain, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RADIUS_RPC = 'https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2';
const SBC_TOKEN = '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.andrs.dev';
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS || '0xDA60059faBf3e71338c27C505CED519f55d605DD';

const radius = defineChain({
  id: 723,
  name: 'Radius',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RADIUS_RPC] } },
});

const permitDomain = {
  name: 'Stable Coin',
  version: '1',
  chainId: 723,
  verifyingContract: SBC_TOKEN as `0x${string}`,
};

const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
]);

// The permit settler contract used by the andrs.dev facilitator
const PERMIT_SETTLER = '0x494C3586A75a5B94e40d9d1780B2B03dbEa37F51';

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('Set PRIVATE_KEY env var (0x-prefixed hex)');
    process.exit(1);
  }

  const iterations = parseInt(process.argv[2] || '5', 10);
  const account = privateKeyToAccount(pk as `0x${string}`);
  const client = createPublicClient({ chain: radius, transport: http() });

  const balance = await client.readContract({
    address: SBC_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log(`Wallet: ${account.address}`);
  console.log(`SBC balance: ${Number(balance) / 1e6} SBC`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);
  console.log(`Iterations: ${iterations}\n`);

  let nonce = await client.readContract({
    address: SBC_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'nonces',
    args: [account.address],
  });

  const verifyResults: number[] = [];
  const settleResults: number[] = [];
  const totalResults: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
    const value = 100n; // 0.0001 SBC

    // Sign permit
    const signature = await account.signTypedData({
      domain: permitDomain,
      types: permitTypes,
      primaryType: 'Permit',
      message: {
        owner: account.address,
        spender: PERMIT_SETTLER as `0x${string}`,
        value,
        nonce,
        deadline,
      },
    });

    const facilitatorBody = JSON.stringify({
      payload: {
        scheme: 'eip2612',
        from: account.address,
        to: PAYMENT_ADDRESS,
        value: value.toString(),
        validAfter: '0',
        validBefore: deadline.toString(),
        nonce: nonce.toString(),
      },
      requirements: {
        tokenAddress: SBC_TOKEN,
        amount: '100',
        recipient: PAYMENT_ADDRESS,
        network: 'eip155:723',
      },
      signature,
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.FACILITATOR_API_KEY) {
      headers['X-API-Key'] = process.env.FACILITATOR_API_KEY;
    }

    // Verify
    const t0 = Date.now();
    const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers,
      body: facilitatorBody,
    });
    const verifyMs = Date.now() - t0;
    const verifyData = await verifyRes.json() as any;

    // Settle
    const t1 = Date.now();
    const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers,
      body: facilitatorBody,
    });
    const settleMs = Date.now() - t1;
    const settleData = await settleRes.json() as any;
    const totalMs = Date.now() - t0;

    const txHash = settleData.transaction || settleData.txHash || settleData.hash || 'n/a';
    const status = verifyData.isValid && settleData.success ? 'OK' : 'FAIL';

    verifyResults.push(verifyMs);
    settleResults.push(settleMs);
    totalResults.push(totalMs);

    console.log(
      `[${i + 1}/${iterations}] verify=${verifyMs}ms settle=${settleMs}ms total=${totalMs}ms ` +
      `status=${status} tx=${txHash}`
    );

    if (status === 'FAIL') {
      console.log('  verify:', JSON.stringify(verifyData));
      console.log('  settle:', JSON.stringify(settleData));
    }

    nonce = nonce + 1n;
  }

  // Stats
  const stats = (arr: number[], label: string) => {
    const sorted = [...arr].sort((a, b) => a - b);
    console.log(
      `${label}: min=${sorted[0]}ms median=${sorted[Math.floor(sorted.length / 2)]}ms ` +
      `avg=${Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)}ms ` +
      `p95=${sorted[Math.floor(sorted.length * 0.95)]}ms max=${sorted[sorted.length - 1]}ms`
    );
  };

  console.log('\n--- Direct Probe Results (no CF Worker) ---');
  stats(verifyResults, 'Verify');
  stats(settleResults, 'Settle');
  stats(totalResults, 'Total ');
  console.log('\nCompare these numbers to Worker-reported verify_ms and settle_ms from a swarm run.');
}

main().catch(console.error);
