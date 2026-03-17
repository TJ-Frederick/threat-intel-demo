/**
 * chain-probe.ts — Measure baseline Radius chain tx confirmation time.
 *
 * Sends simple ERC-20 self-transfers on Radius (chain 723) and measures
 * the time from sendTransaction to waitForTransactionReceipt.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/chain-probe.ts [iterations]
 */

import { createPublicClient, createWalletClient, http, defineChain, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RADIUS_RPC = 'https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2';
const SBC_TOKEN = '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb' as const;

const radius = defineChain({
  id: 723,
  name: 'Radius',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RADIUS_RPC] } },
});

const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('Set PRIVATE_KEY env var (0x-prefixed hex)');
    process.exit(1);
  }

  const iterations = parseInt(process.argv[2] || '10', 10);
  const account = privateKeyToAccount(pk as `0x${string}`);

  const publicClient = createPublicClient({ chain: radius, transport: http() });
  const walletClient = createWalletClient({ account, chain: radius, transport: http() });

  // Check balance
  const balance = await publicClient.readContract({
    address: SBC_TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log(`Wallet: ${account.address}`);
  console.log(`SBC balance: ${balance} (${Number(balance) / 1e6} SBC)`);

  if (balance === 0n) {
    console.error('Wallet has no SBC tokens. Fund it first.');
    process.exit(1);
  }

  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const t0 = Date.now();

    // Self-transfer of 1 unit (0.000001 SBC)
    // Use explicit gas params — Radius requires non-zero gasPrice and doesn't support EIP-1559 fee estimation reliably
    const hash = await walletClient.writeContract({
      address: SBC_TOKEN,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [account.address, 1n],
      gas: 100_000n,
      gasPrice: 1_000_000_000n,
    });
    const txSubmitMs = Date.now() - t0;

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const totalMs = Date.now() - t0;
    const confirmMs = totalMs - txSubmitMs;

    results.push(totalMs);
    console.log(
      `[${i + 1}/${iterations}] tx=${hash.slice(0, 14)}... ` +
      `submit=${txSubmitMs}ms confirm=${confirmMs}ms total=${totalMs}ms ` +
      `block=${receipt.blockNumber} status=${receipt.status}`
    );
  }

  // Stats
  results.sort((a, b) => a - b);
  const min = results[0];
  const max = results[results.length - 1];
  const median = results[Math.floor(results.length / 2)];
  const p95 = results[Math.floor(results.length * 0.95)];
  const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);

  console.log('\n--- Results ---');
  console.log(`Iterations: ${iterations}`);
  console.log(`Min: ${min}ms`);
  console.log(`Median: ${median}ms`);
  console.log(`Avg: ${avg}ms`);
  console.log(`P95: ${p95}ms`);
  console.log(`Max: ${max}ms`);
}

main().catch(console.error);
