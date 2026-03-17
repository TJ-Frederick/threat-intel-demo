/**
 * contention-test.ts — Prove whether recipient key-lock contention is the throughput bottleneck.
 *
 * Sends N concurrent ERC-20 transfers from N different wallets, comparing:
 *   Test A: All send to the SAME recipient (contended key)
 *   Test B: All send to DIFFERENT recipients (no contention)
 *
 * If Test B throughput >> Test A throughput, the recipient balance slot is the bottleneck.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/contention-test.ts [numWallets]
 *
 * The PRIVATE_KEY wallet funds the test wallets. Needs ~0.01 ETH + ~0.001 SBC.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseAbi,
  type Hash,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const RADIUS_RPC = 'https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2';
const SBC_TOKEN = '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb' as const;

const radius = defineChain({
  id: 723,
  name: 'Radius',
  nativeCurrency: { name: 'RUSD', symbol: 'RUSD', decimals: 18 },
  rpcUrls: { default: { http: [RADIUS_RPC] } },
});

const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

const publicClient = createPublicClient({ chain: radius, transport: http() });

async function fundWallets(
  funderPk: `0x${string}`,
  wallets: ReturnType<typeof privateKeyToAccount>[],
  sbcPerWallet: bigint
) {
  const funder = privateKeyToAccount(funderPk);
  const funderWallet = createWalletClient({ account: funder, chain: radius, transport: http() });

  console.log('Funding wallets with SBC + RUSD for gas...');

  // Fund each wallet sequentially (to avoid funder nonce conflicts)
  for (let i = 0; i < wallets.length; i++) {
    // Send SBC tokens
    const sbcHash = await funderWallet.writeContract({
      address: SBC_TOKEN,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [wallets[i].address, sbcPerWallet],
      gas: 100_000n,
      gasPrice: 1_000_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: sbcHash });

    // Send native RUSD for gas (~0.0002 RUSD, enough for 2 transfers)
    const ethHash = await funderWallet.sendTransaction({
      to: wallets[i].address,
      value: 200_000_000_000_000n, // 0.0002 RUSD
      gas: 21_000n,
      gasPrice: 1_000_000_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: ethHash });

    process.stdout.write(`  Funded wallet ${i + 1}/${wallets.length}\r`);
  }
  console.log('');
}

interface TestResult {
  label: string;
  totalMs: number;
  txCount: number;
  throughput: number;
  perTxMs: number[];
  txHashes: string[];
  blockNumbers: bigint[];
}

async function runConcurrentTransfers(
  wallets: ReturnType<typeof privateKeyToAccount>[],
  recipients: `0x${string}`[],
  label: string
): Promise<TestResult> {
  console.log(`\n--- ${label} ---`);
  console.log(`Senders: ${wallets.length}, Recipients: ${new Set(recipients).size}`);

  const walletClients = wallets.map((account) =>
    createWalletClient({ account, chain: radius, transport: http() })
  );

  const t0 = Date.now();

  // Fire ALL transfers concurrently
  const promises = walletClients.map(async (wc, i) => {
    try {
      const txT0 = Date.now();
      const hash = await wc.writeContract({
        address: SBC_TOKEN,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipients[i], 1n],
        gas: 100_000n,
        gasPrice: 1_000_000_000n,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const txMs = Date.now() - txT0;
      return { hash, txMs, blockNumber: receipt.blockNumber, ok: true as const };
    } catch (e: any) {
      return { hash: '', txMs: 0, blockNumber: 0n, ok: false as const, error: e.shortMessage || e.message };
    }
  });

  const allResults = await Promise.all(promises);
  const totalMs = Date.now() - t0;

  const results = allResults.filter((r) => r.ok);
  const failed = allResults.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`  ${failed.length} tx(s) failed: ${(failed[0] as any).error}`);
  }

  const perTxMs = results.map((r) => r.txMs);
  const txHashes = results.map((r) => r.hash);
  const blockNumbers = results.map((r) => r.blockNumber);

  perTxMs.sort((a, b) => a - b);
  const throughput = (wallets.length / totalMs) * 1000;

  console.log(`Total wall time: ${totalMs}ms`);
  console.log(`Throughput: ${throughput.toFixed(1)} tx/s`);
  console.log(`Per-tx latency: min=${perTxMs[0]}ms median=${perTxMs[Math.floor(perTxMs.length / 2)]}ms max=${perTxMs[perTxMs.length - 1]}ms`);

  // Block distribution
  const blockSet = new Map<bigint, number>();
  for (const bn of blockNumbers) {
    blockSet.set(bn, (blockSet.get(bn) || 0) + 1);
  }
  const uniqueBlocks = blockSet.size;
  const maxPerBlock = Math.max(...blockSet.values());
  console.log(`Blocks used: ${uniqueBlocks}, max txs in one block: ${maxPerBlock}`);

  return { label, totalMs, txCount: wallets.length, throughput, perTxMs, txHashes, blockNumbers };
}

async function main() {
  const pk = process.env.PRIVATE_KEY as `0x${string}`;
  if (!pk) {
    console.error('Set PRIVATE_KEY env var');
    process.exit(1);
  }

  const numWallets = parseInt(process.argv[2] || '10', 10);
  console.log(`Contention test with ${numWallets} concurrent wallets\n`);

  // Generate ephemeral wallets
  const walletKeys = Array.from({ length: numWallets }, () => generatePrivateKey());
  const wallets = walletKeys.map((k) => privateKeyToAccount(k));

  // Generate unique recipient addresses (for Test B)
  const uniqueRecipients = Array.from({ length: numWallets }, () => {
    return privateKeyToAccount(generatePrivateKey()).address;
  });

  // Single shared recipient (for Test A)
  const sharedRecipient = '0xDA60059faBf3e71338c27C505CED519f55d605DD' as `0x${string}`;

  // Fund wallets: 100 SBC units each (enough for a few transfers)
  await fundWallets(pk, wallets, 100n);

  // Test A: All send to SAME recipient
  const resultA = await runConcurrentTransfers(
    wallets,
    Array(numWallets).fill(sharedRecipient),
    'Test A: SAME recipient (contended)'
  );

  // Test B: Each sends to a DIFFERENT recipient
  const resultB = await runConcurrentTransfers(
    wallets,
    uniqueRecipients,
    'Test B: DIFFERENT recipients (no contention)'
  );

  // Comparison
  console.log('\n=== COMPARISON ===\n');
  console.log(`                  Same Recipient    Different Recipients`);
  console.log(`Wall time:        ${resultA.totalMs}ms              ${resultB.totalMs}ms`);
  console.log(`Throughput:       ${resultA.throughput.toFixed(1)} tx/s           ${resultB.throughput.toFixed(1)} tx/s`);
  console.log(`Median latency:   ${resultA.perTxMs[Math.floor(resultA.perTxMs.length / 2)]}ms              ${resultB.perTxMs[Math.floor(resultB.perTxMs.length / 2)]}ms`);
  console.log(`Max latency:      ${resultA.perTxMs[resultA.perTxMs.length - 1]}ms              ${resultB.perTxMs[resultB.perTxMs.length - 1]}ms`);
  console.log(`Unique blocks:    ${new Set(resultA.blockNumbers).size}                 ${new Set(resultB.blockNumbers).size}`);

  const speedup = resultB.throughput / resultA.throughput;
  console.log(`\nSpeedup (B/A):    ${speedup.toFixed(1)}x`);

  if (speedup > 2) {
    console.log('\nCONFIRMED: Recipient key-lock contention is the bottleneck.');
    console.log('Different recipients achieve significantly higher throughput.');
  } else if (speedup > 1.3) {
    console.log('\nLIKELY: Some contention effect, but other factors also contribute.');
  } else {
    console.log('\nNOT CONFIRMED: Throughput is similar. The bottleneck is elsewhere.');
  }
}

main().catch(console.error);
