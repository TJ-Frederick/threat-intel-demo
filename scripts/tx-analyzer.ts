/**
 * tx-analyzer.ts — Analyze settlement tx distribution across Radius blocks.
 *
 * Takes tx hashes from a swarm run and reports:
 * - Txs-per-block distribution (contention signal)
 * - Block intervals (chain throughput)
 * - Whether settlements serialize across blocks
 *
 * Usage:
 *   npx tsx scripts/tx-analyzer.ts <hash1> <hash2> ...
 *   echo "0xabc 0xdef 0x123" | npx tsx scripts/tx-analyzer.ts
 */

import { createPublicClient, http, defineChain } from 'viem';

const RADIUS_RPC = 'https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2';

const radius = defineChain({
  id: 723,
  name: 'Radius',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RADIUS_RPC] } },
});

interface TxInfo {
  hash: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  status: string;
  gasUsed: bigint;
}

async function main() {
  let hashes: string[] = [];

  // Accept hashes from args or stdin
  if (process.argv.length > 2) {
    hashes = process.argv.slice(2).flatMap(a => a.split(/[\s,]+/).filter(Boolean));
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const input = Buffer.concat(chunks).toString();
    hashes = input.split(/[\s,]+/).filter(h => h.startsWith('0x'));
  }

  if (hashes.length === 0) {
    console.error('No tx hashes provided. Pass as args or pipe via stdin.');
    console.error('Usage: npx tsx scripts/tx-analyzer.ts 0xabc 0xdef ...');
    process.exit(1);
  }

  console.log(`Analyzing ${hashes.length} transactions...\n`);

  const client = createPublicClient({ chain: radius, transport: http() });
  const blockCache = new Map<bigint, { timestamp: bigint; txCount: number }>();

  // Fetch all receipts in parallel (batches of 10 to avoid overload)
  const txInfos: TxInfo[] = [];
  const batchSize = 10;

  for (let i = 0; i < hashes.length; i += batchSize) {
    const batch = hashes.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (hash) => {
        try {
          const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });

          if (!blockCache.has(receipt.blockNumber)) {
            const block = await client.getBlock({ blockNumber: receipt.blockNumber });
            blockCache.set(receipt.blockNumber, {
              timestamp: block.timestamp,
              txCount: block.transactions.length,
            });
          }

          return {
            hash,
            blockNumber: receipt.blockNumber,
            blockTimestamp: blockCache.get(receipt.blockNumber)!.timestamp,
            status: receipt.status,
            gasUsed: receipt.gasUsed,
          } as TxInfo;
        } catch (e: any) {
          console.error(`Failed to fetch ${hash}: ${e.message}`);
          return null;
        }
      })
    );
    txInfos.push(...results.filter((r): r is TxInfo => r !== null));
  }

  // Sort by block number
  txInfos.sort((a, b) => Number(a.blockNumber - b.blockNumber));

  // Per-block analysis
  const blockGroups = new Map<bigint, TxInfo[]>();
  for (const tx of txInfos) {
    if (!blockGroups.has(tx.blockNumber)) blockGroups.set(tx.blockNumber, []);
    blockGroups.get(tx.blockNumber)!.push(tx);
  }

  console.log('=== Per-Block Distribution ===\n');
  const sortedBlocks = [...blockGroups.entries()].sort((a, b) => Number(a[0] - b[0]));

  for (const [blockNum, txs] of sortedBlocks) {
    const blockInfo = blockCache.get(blockNum)!;
    console.log(
      `Block ${blockNum}: ${txs.length} settlement tx(s) / ${blockInfo.txCount} total in block ` +
      `(timestamp: ${blockInfo.timestamp})`
    );
  }

  // Block interval analysis
  console.log('\n=== Block Intervals ===\n');
  const blockNums = sortedBlocks.map(([n]) => n);
  const intervals: number[] = [];

  for (let i = 1; i < sortedBlocks.length; i++) {
    const prevTs = blockCache.get(sortedBlocks[i - 1][0])!.timestamp;
    const currTs = blockCache.get(sortedBlocks[i][0])!.timestamp;
    const intervalSec = Number(currTs - prevTs);
    const blockGap = Number(sortedBlocks[i][0] - sortedBlocks[i - 1][0]);
    intervals.push(intervalSec);
    console.log(
      `Block ${sortedBlocks[i - 1][0]} → ${sortedBlocks[i][0]} ` +
      `(gap: ${blockGap} blocks, ${intervalSec}s)`
    );
  }

  // Summary stats
  console.log('\n=== Summary ===\n');
  console.log(`Total txs analyzed: ${txInfos.length}`);
  console.log(`Blocks spanned: ${blockNums.length} (${blockNums[0]} → ${blockNums[blockNums.length - 1]})`);

  const txsPerBlock = sortedBlocks.map(([, txs]) => txs.length);
  console.log(`Settlement txs per block: min=${Math.min(...txsPerBlock)} max=${Math.max(...txsPerBlock)} avg=${(txsPerBlock.reduce((a, b) => a + b, 0) / txsPerBlock.length).toFixed(1)}`);

  const totalBlocksInBlock = sortedBlocks.map(([n]) => blockCache.get(n)!.txCount);
  console.log(`Total txs per block: min=${Math.min(...totalBlocksInBlock)} max=${Math.max(...totalBlocksInBlock)} avg=${(totalBlocksInBlock.reduce((a, b) => a + b, 0) / totalBlocksInBlock.length).toFixed(1)}`);

  if (intervals.length > 0) {
    console.log(`Block intervals (s): min=${Math.min(...intervals)} max=${Math.max(...intervals)} avg=${(intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1)}`);
  }

  // Contention assessment
  console.log('\n=== Contention Assessment ===\n');
  const singleTxBlocks = txsPerBlock.filter(n => n === 1).length;
  const multiTxBlocks = txsPerBlock.filter(n => n > 1).length;

  if (singleTxBlocks > multiTxBlocks * 3) {
    console.log('STRONG contention signal: Most blocks contain only 1 settlement tx.');
    console.log('This suggests key-lock serialization on the recipient balance slot.');
  } else if (multiTxBlocks > singleTxBlocks) {
    console.log('LOW contention signal: Multiple settlement txs frequently share blocks.');
    console.log('The bottleneck is likely in the facilitator, not chain-level key locking.');
  } else {
    console.log('MIXED signal: Some blocks have multiple txs, some have one.');
    console.log('Run with more txs for a clearer picture.');
  }
}

main().catch(console.error);
