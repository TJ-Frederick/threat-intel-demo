/**
 * x402 Agent Swarm Module
 *
 * Reusable browser-side module for orchestrating parallel x402-paid HTTP requests.
 * Generates ephemeral agent wallets, batch-funds them, and runs concurrent
 * request loops with Permit2 + EIP-2612 payment signing.
 *
 * Usage:
 *   import { createSwarm, signX402Payment } from '/modules/swarm.js';
 *
 *   // Create swarm (Radius chain defaults, just provide paymentAddress + rpcUrl)
 *   const swarm = createSwarm({ paymentAddress: ADDR, rpcUrl: RPC });
 *
 *   // Launch agents
 *   await swarm.launch({
 *     numAgents: 10,
 *     requestsPerAgent: 5,
 *     generateRequests: (agentIdx, count) =>
 *       myUrls.map(u => ({ url: u, description: 'Fetch ' + u })),
 *     callbacks: { onAgentLog: ..., onStatsUpdate: ..., onComplete: ... },
 *     walletClient,
 *     address: connectedAddress,
 *   });
 *
 *   // Single paid request (no swarm needed)
 *   const { xPayment } = await signX402Payment({ signTypedData, owner, permitNonce, resource, accepted, config });
 *   const res = await fetch(url, { headers: { 'X-Payment': xPayment } });
 */
export function getSwarmModuleJs(): string {
  return `
import { createPublicClient, http, encodeFunctionData, decodeFunctionResult, defineChain } from 'https://esm.sh/viem';
import { privateKeyToAccount } from 'https://esm.sh/viem/accounts';

// ── Radius chain defaults ──

const RADIUS_DEFAULTS = {
  chainId: 723487,
  chainName: 'Radius',
  tokenAddress: '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb',
  tokenName: 'Stable Coin',
  tokenVersion: '1',
  tokenDecimals: 6,
  permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  x402Permit2Proxy: '0x402085c248EeA27D92E8b30b2C58ed07f9E20001',
  batchContractAddress: '0x71e14b65a8305a9a95a675abccb993f929b53885',
  amountPerRequest: '100',
  maxRetries: 3,
};

// ── Token ABI encoders ──

const balanceOfData = (addr) => encodeFunctionData({
  abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'balanceOf', args: [addr],
});

const noncesData = (addr) => encodeFunctionData({
  abi: [{ name: 'nonces', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'nonces', args: [addr],
});

const decodeUint = (data) => decodeFunctionResult({
  abi: [{ name: 'x', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
  functionName: 'x', data,
});

const approveData = (spender, amount) => encodeFunctionData({
  abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' }],
  functionName: 'approve', args: [spender, amount],
});

const batchTransferCallData = (token, recipients, amounts) => encodeFunctionData({
  abi: [{ name: 'batchTransfer', type: 'function', inputs: [{ name: 'token', type: 'address' }, { name: 'recipients', type: 'address[]' }, { name: 'amounts', type: 'uint256[]' }], outputs: [], stateMutability: 'nonpayable' }],
  functionName: 'batchTransfer', args: [token, recipients, amounts],
});

function randomPermit2Nonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
}

// ── Helpers ──

async function estimateGasWithFallback(publicClient, txParams, fallbackGas) {
  try {
    const estimate = await publicClient.estimateGas({
      account: txParams.from, to: txParams.to, data: txParams.data,
    });
    return '0x' + (estimate + estimate / BigInt(5)).toString(16);
  } catch (e) {
    return '0x' + BigInt(fallbackGas).toString(16);
  }
}

async function waitForTx(publicClient, txHash) {
  for (let i = 0; i < 60; i++) {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null);
    if (receipt) {
      if (receipt.status === 'reverted') {
        const err = new Error('Transaction reverted (' + txHash.slice(0, 10) + '...)');
        err.txHash = txHash;
        throw err;
      }
      return receipt;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Transaction not confirmed after 60s');
}

// ── signX402Payment ──
// Signs EIP-2612 + Permit2 permits and builds the x402 payment payload.
// Works for both swarm agents (account.signTypedData) and browser wallets
// (walletClient.signTypedData).

export async function signX402Payment({ signTypedData, owner, permitNonce, resource, accepted, config }) {
  const cfg = { ...RADIUS_DEFAULTS, ...config };
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const amount = accepted ? accepted.amount : cfg.amountPerRequest;

  const permitDomain = {
    name: cfg.tokenName, version: cfg.tokenVersion,
    chainId: cfg.chainId, verifyingContract: cfg.tokenAddress,
  };
  const permitTypes = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const permit2Domain = {
    name: 'Permit2', chainId: cfg.chainId, verifyingContract: cfg.permit2Address,
  };
  const permit2Types = {
    PermitWitnessTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'witness', type: 'Witness' },
    ],
    TokenPermissions: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    Witness: [
      { name: 'to', type: 'address' },
      { name: 'validAfter', type: 'uint256' },
    ],
  };

  // 1. Sign EIP-2612 permit (approve Permit2 contract)
  const eip2612Signature = await signTypedData({
    domain: permitDomain,
    types: permitTypes,
    primaryType: 'Permit',
    message: {
      owner: owner,
      spender: cfg.permit2Address,
      value: BigInt(amount),
      nonce: permitNonce,
      deadline: deadline,
    },
  });

  // 2. Sign Permit2 PermitWitnessTransferFrom
  const p2Nonce = randomPermit2Nonce();
  const permit2Signature = await signTypedData({
    domain: permit2Domain,
    types: permit2Types,
    primaryType: 'PermitWitnessTransferFrom',
    message: {
      permitted: { token: cfg.tokenAddress, amount: BigInt(amount) },
      spender: cfg.x402Permit2Proxy,
      nonce: p2Nonce,
      deadline: deadline,
      witness: { to: cfg.paymentAddress, validAfter: BigInt(0) },
    },
  });

  // 3. Build payload
  const acceptedReq = accepted || {
    scheme: 'exact',
    network: 'eip155:' + cfg.chainId,
    amount: cfg.amountPerRequest,
    asset: cfg.tokenAddress,
    payTo: cfg.paymentAddress,
    maxTimeoutSeconds: 300,
    extra: { name: cfg.tokenName, version: cfg.tokenVersion, assetTransferMethod: 'permit2' },
  };

  const payload = {
    x402Version: 2,
    scheme: 'exact',
    network: 'eip155:' + cfg.chainId,
    resource: {
      url: resource.url,
      description: resource.description || '',
      mimeType: resource.mimeType || 'application/json',
    },
    accepted: acceptedReq,
    payload: {
      signature: permit2Signature,
      permit2Authorization: {
        permitted: { token: cfg.tokenAddress, amount: amount.toString() },
        from: owner,
        spender: cfg.x402Permit2Proxy,
        nonce: p2Nonce.toString(),
        deadline: deadline.toString(),
        witness: { to: cfg.paymentAddress, validAfter: '0' },
      },
    },
    extensions: {
      eip2612GasSponsoring: {
        info: {
          amount: amount.toString(),
          deadline: deadline.toString(),
          signature: eip2612Signature,
        },
      },
    },
  };

  return { payload, xPayment: btoa(JSON.stringify(payload)) };
}

// ── createSwarm ──

export function createSwarm(userConfig) {
  if (!userConfig.paymentAddress) throw new Error('paymentAddress is required');
  if (!userConfig.rpcUrl) throw new Error('rpcUrl is required');

  const cfg = { ...RADIUS_DEFAULTS, ...userConfig };

  const chain = defineChain({
    id: cfg.chainId,
    name: cfg.chainName,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });

  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });

  let abortFlag = false;
  let running = false;
  let currentCallbacks = null;

  async function getNonce(addr) {
    const data = await publicClient.call({ to: cfg.tokenAddress, data: noncesData(addr) });
    return decodeUint(data.data);
  }

  async function getBalance(addr) {
    const data = await publicClient.call({ to: cfg.tokenAddress, data: balanceOfData(addr) });
    return decodeUint(data.data);
  }

  async function launch({ numAgents, requestsPerAgent, generateRequests, callbacks, walletClient, address }) {
    if (running) throw new Error('Swarm is already running');

    const cb = callbacks || {};
    currentCallbacks = cb;
    abortFlag = false;
    running = true;

    const agentCount = Math.min(100, Math.max(1, numAgents || 10));
    const perAgent = Math.max(1, requestsPerAgent || 2);
    const amount = BigInt(cfg.amountPerRequest);
    const amountPerAgent = BigInt(perAgent) * amount;

    try {
      // 1. Generate agent wallets
      cb.onStatus?.('Generating ' + agentCount + ' agent wallets...');
      const agents = [];
      for (let i = 0; i < agentCount; i++) {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const hex = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        agents.push({ account: privateKeyToAccount(hex), key: hex });
      }

      // 2. Check balances
      const totalFunding = amountPerAgent * BigInt(agentCount);
      cb.onStatus?.('Checking balances...');

      const ethBalance = await publicClient.getBalance({ address });
      if (ethBalance < BigInt(5000000000000000)) {
        throw new Error('Insufficient ETH for gas. Need ~0.005 ETH, have ' + (Number(ethBalance) / 1e18).toFixed(4) + ' ETH.');
      }

      // 3. Approve batch contract
      cb.onFundingStep?.('approve', 'pending');
      cb.onStatus?.('Estimating gas...');
      const approveCallData = approveData(cfg.batchContractAddress, totalFunding);
      const approveGas = await estimateGasWithFallback(
        publicClient, { from: address, to: cfg.tokenAddress, data: approveCallData }, 200000
      );

      cb.onStatus?.('Approving batch funding... Confirm in wallet.');
      const approveTxHash = await walletClient.sendTransaction({
        account: address, to: cfg.tokenAddress, data: approveCallData,
        gas: BigInt(parseInt(approveGas, 16)), chain,
      });
      cb.onStatus?.('Waiting for approval tx...');
      await waitForTx(publicClient, approveTxHash);
      cb.onFundingStep?.('approve', 'confirmed');

      // 4. Batch fund agents
      cb.onFundingStep?.('batch-transfer', 'pending');
      const recipients = agents.map(a => a.account.address);
      const amounts = agents.map(() => amountPerAgent);
      const batchCallData = batchTransferCallData(cfg.tokenAddress, recipients, amounts);
      const batchGas = await estimateGasWithFallback(
        publicClient, { from: address, to: cfg.batchContractAddress, data: batchCallData },
        200000 + agentCount * 100000
      );

      cb.onStatus?.('Batch funding ' + agentCount + ' agents... Confirm in wallet.');
      const batchTxHash = await walletClient.sendTransaction({
        account: address, to: cfg.batchContractAddress, data: batchCallData,
        gas: BigInt(parseInt(batchGas, 16)), chain,
      });
      cb.onStatus?.('Waiting for batch funding tx...');
      await waitForTx(publicClient, batchTxHash);
      cb.onFundingStep?.('batch-transfer', 'confirmed');

      // 5. Run agent work loops
      cb.onStatus?.('Swarm active!');
      let totalReqs = 0, totalSpent = 0;
      const startTime = Date.now();

      const agentWork = async (agent, agentIdx) => {
        const account = agent.account;
        const requests = generateRequests(agentIdx, perAgent);
        let currentPermitNonce = await getNonce(account.address);

        for (let i = 0; i < requests.length; i++) {
          if (abortFlag) return;
          const req = requests[i];
          let success = false;

          for (let attempt = 0; attempt < cfg.maxRetries && !success && !abortFlag; attempt++) {
            try {
              if (attempt > 0) {
                try { currentPermitNonce = await getNonce(account.address); } catch(e) {}
              }

              const { xPayment } = await signX402Payment({
                signTypedData: (params) => account.signTypedData(params),
                owner: account.address,
                permitNonce: currentPermitNonce,
                resource: req,
                accepted: null,
                config: cfg,
              });

              const t0 = Date.now();
              const res = await fetch(req.url, { headers: { 'X-Payment': xPayment } });
              const fetchMs = Date.now() - t0;

              if (!res.ok) {
                if (attempt < cfg.maxRetries - 1) {
                  await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
                  continue;
                }
                const errBody = await res.text().catch(() => '');
                throw new Error('HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 120) : ''));
              }

              const data = await res.json();
              currentPermitNonce = currentPermitNonce + BigInt(1);
              success = true;

              totalReqs++;
              totalSpent += Number(amount);
              const elapsed = (Date.now() - startTime) / 1000;
              cb.onStatsUpdate?.({
                totalRequests: totalReqs,
                totalSpentRaw: totalSpent,
                elapsedMs: Date.now() - startTime,
                requestsPerSecond: elapsed > 0 ? totalReqs / elapsed : 0,
              });
              cb.onAgentLog?.({
                agentIndex: agentIdx,
                requestId: req.description || req.url,
                isError: false,
                txHash: data.tx_hash,
                responseData: data,
                latencyMs: fetchMs,
              });
            } catch (err) {
              if (attempt >= cfg.maxRetries - 1) {
                cb.onAgentLog?.({
                  agentIndex: agentIdx,
                  requestId: req.description || req.url,
                  message: err.message,
                  isError: true,
                });
                try { currentPermitNonce = await getNonce(account.address); } catch(e) {}
              }
            }
          }
        }
      };

      await Promise.all(agents.map((agent, idx) => agentWork(agent, idx)));

      const elapsed = (Date.now() - startTime) / 1000;
      const finalStats = {
        totalRequests: totalReqs,
        totalSpentRaw: totalSpent,
        elapsedMs: Date.now() - startTime,
        requestsPerSecond: elapsed > 0 ? totalReqs / elapsed : 0,
      };
      cb.onComplete?.(finalStats);
      return finalStats;

    } finally {
      running = false;
      currentCallbacks = null;
    }
  }

  function stop() {
    abortFlag = true;
    currentCallbacks?.onStatus?.('Stopping...');
  }

  function isRunning() { return running; }

  return { launch, stop, isRunning, getBalance, getNonce, chain, config: cfg };
}
`;
}
