export function getFrontendHtml(paymentAddress: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Threat Intel API</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0a; color: #e0e0e0; font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
    line-height: 1.6; min-height: 100vh;
  }
  ::selection { background: #00ff8833; color: #fff; }
  a { color: #00ff88; text-decoration: none; }
  a:hover { text-decoration: underline; }

  .container { max-width: 960px; margin: 0 auto; padding: 40px 24px; }

  /* Header */
  header { text-align: center; margin-bottom: 48px; }
  header h1 {
    font-size: 2.4rem; font-weight: 700; letter-spacing: -0.02em;
    background: linear-gradient(135deg, #00ff88, #00cc6a);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; margin-bottom: 8px;
  }
  header p.subtitle {
    color: #888; font-size: 0.95rem; max-width: 520px; margin: 0 auto 24px;
  }
  .wallet-bar {
    display: flex; align-items: center; justify-content: center; gap: 16px;
    flex-wrap: wrap;
  }
  .wallet-info {
    font-size: 0.85rem; color: #aaa;
    background: #111; border: 1px solid #222; border-radius: 8px;
    padding: 8px 16px; display: none; align-items: center; gap: 12px;
  }
  .wallet-info.visible { display: flex; }
  .wallet-info .addr { color: #00ff88; }
  .wallet-info .bal { color: #fff; }

  /* Buttons */
  .btn {
    background: #00ff88; color: #0a0a0a; border: none; border-radius: 8px;
    padding: 10px 24px; font-family: inherit; font-size: 0.9rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .btn:hover { background: #00e67a; transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .btn-outline {
    background: transparent; color: #00ff88; border: 1px solid #00ff88;
  }
  .btn-outline:hover { background: #00ff8815; }
  .btn-danger { background: #ff4444; color: #fff; }
  .btn-danger:hover { background: #e63c3c; }

  /* Sections */
  .section {
    background: #111; border: 1px solid #1a1a1a; border-radius: 12px;
    padding: 32px; margin-bottom: 32px;
  }
  .section h2 {
    font-size: 1.1rem; color: #00ff88; margin-bottom: 8px; font-weight: 600;
  }
  .section p.desc { color: #666; font-size: 0.85rem; margin-bottom: 20px; }

  /* Inputs */
  .input-row { display: flex; gap: 12px; margin-bottom: 16px; }
  input[type="text"], input[type="number"], textarea {
    background: #0a0a0a; border: 1px solid #333; border-radius: 8px;
    padding: 10px 14px; color: #e0e0e0; font-family: inherit; font-size: 0.9rem;
    outline: none; transition: border-color 0.15s;
  }
  input[type="text"]:focus, input[type="number"]:focus, textarea:focus {
    border-color: #00ff88;
  }
  input[type="text"] { flex: 1; }
  textarea {
    width: 100%; min-height: 100px; resize: vertical;
  }
  label { font-size: 0.85rem; color: #888; display: block; margin-bottom: 6px; }

  /* Results */
  .result-block {
    background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 8px;
    padding: 20px; margin-top: 16px; display: none; position: relative;
  }
  .result-block.visible { display: block; }
  .result-block pre {
    color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;
    word-break: break-all; line-height: 1.5;
  }
  .result-meta {
    margin-top: 12px; padding-top: 12px; border-top: 1px solid #1a1a1a;
    font-size: 0.8rem; color: #888;
  }
  .result-meta span { color: #00ff88; }
  .curl-block {
    margin-top: 12px; background: #080808; border: 1px solid #1a1a1a;
    border-radius: 8px; padding: 14px; position: relative;
  }
  .curl-block code { font-size: 0.78rem; color: #999; word-break: break-all; }
  .copy-btn {
    position: absolute; top: 8px; right: 8px; background: #222; border: 1px solid #333;
    color: #888; font-size: 0.7rem; padding: 4px 10px; border-radius: 4px;
    cursor: pointer; font-family: inherit;
  }
  .copy-btn:hover { background: #333; color: #ccc; }

  /* Swarm dashboard */
  .stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px; margin-bottom: 20px;
  }
  .stat-card {
    background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 8px;
    padding: 16px; text-align: center;
  }
  .stat-card .val {
    font-size: 1.8rem; font-weight: 700; color: #00ff88;
  }
  .stat-card .lbl { font-size: 0.75rem; color: #666; margin-top: 4px; }
  .swarm-log {
    background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 8px;
    padding: 16px; height: 260px; overflow-y: auto; font-size: 0.8rem;
    color: #888; display: none;
  }
  .swarm-log.visible { display: block; }
  .swarm-log .entry { padding: 3px 0; border-bottom: 1px solid #0f0f0f; }
  .swarm-log .entry .ok { color: #00ff88; }
  .swarm-log .entry .err { color: #ff4444; }
  .swarm-controls { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  .swarm-controls .field { flex: 1; min-width: 140px; }

  /* Status */
  .status-msg {
    font-size: 0.85rem; color: #888; min-height: 1.4em; margin-top: 8px;
  }
  .status-msg.error { color: #ff4444; }

  /* Footer */
  footer {
    text-align: center; padding: 32px 0 16px; color: #333; font-size: 0.8rem;
  }

  /* Spinner */
  .spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid #00ff8844; border-top-color: #00ff88;
    border-radius: 50%; animation: spin 0.6s linear infinite;
    vertical-align: middle; margin-right: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* JSON syntax highlighting */
  .json-key { color: #00ff88; }
  .json-str { color: #ffd700; }
  .json-num { color: #ff6b6b; }
  .json-bool { color: #69b7ff; }
  .json-null { color: #888; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Threat Intel API</h1>
    <p class="subtitle">Pay-per-query security intelligence. No API key. No signup. $0.0001 per request.</p>
    <div class="wallet-bar">
      <button class="btn" id="connectBtn" onclick="connectWallet()">Connect Wallet</button>
      <div class="wallet-info" id="walletInfo">
        <span class="addr" id="walletAddr"></span>
        <span class="bal" id="walletBal">— SBC</span>
      </div>
    </div>
  </header>

  <!-- Manual Query -->
  <div class="section">
    <h2>Manual Query</h2>
    <p class="desc">Enter an IP address to get threat intelligence. Costs 0.0001 SBC per query.</p>
    <div class="input-row">
      <input type="text" id="ipInput" value="185.220.101.42" placeholder="Enter IP address" />
      <button class="btn" id="queryBtn" onclick="runQuery()" disabled>Query</button>
    </div>
    <div class="status-msg" id="queryStatus"></div>
    <div class="result-block" id="queryResult">
      <pre id="queryJson"></pre>
      <div class="result-meta">
        Cost: <span id="resultCost">$0.0001</span> &nbsp;|&nbsp; Settlement: <span id="resultTime">—</span>
      </div>
      <div class="curl-block">
        <button class="copy-btn" onclick="copyCurl()">Copy</button>
        <code id="curlCmd"></code>
      </div>
    </div>
  </div>

  <!-- Swarm Demo -->
  <div class="section">
    <h2>Swarm Demo</h2>
    <p class="desc">Launch autonomous agents that query the API in parallel. Agents are funded from your wallet automatically.</p>
    <div class="swarm-controls">
      <div class="field">
        <label>Agents</label>
        <input type="number" id="swarmAgents" value="5" min="1" max="10" style="width:100%" onchange="updateCost()" oninput="updateCost()" />
      </div>
      <div class="field">
        <label>Requests per Agent</label>
        <input type="number" id="swarmCount" value="20" min="1" max="1000" style="width:100%" onchange="updateCost()" oninput="updateCost()" />
      </div>
      <div class="field">
        <label>Total Cost</label>
        <div id="swarmCost" style="padding: 10px 0; color: #00ff88; font-size: 0.95rem; font-weight: 600;">0.0100 SBC</div>
      </div>
    </div>
    <div style="margin-top: 16px; display: flex; gap: 8px;">
      <button class="btn" id="swarmBtn" onclick="launchSwarm()" disabled>Launch Swarm</button>
      <button class="btn btn-danger" id="swarmStop" onclick="stopSwarm()" style="display:none">Stop</button>
    </div>
    <div class="status-msg" id="swarmStatus"></div>
    <div class="stats-grid" id="swarmStats" style="margin-top: 20px; display: none;">
      <div class="stat-card"><div class="val" id="statTotal">0</div><div class="lbl">Requests</div></div>
      <div class="stat-card"><div class="val" id="statSpent">0</div><div class="lbl">SBC Spent</div></div>
      <div class="stat-card"><div class="val" id="statRps">0</div><div class="lbl">Req/s</div></div>
      <div class="stat-card"><div class="val" id="statLatency">0</div><div class="lbl">Avg Latency (ms)</div></div>
    </div>
    <div class="swarm-log" id="swarmLog"></div>
  </div>

  <footer>Powered by Radius Network · SBC x402 Protocol</footer>
</div>

<script type="module">
import { createPublicClient, createWalletClient, http, encodeFunctionData, decodeFunctionResult, custom, defineChain } from 'https://esm.sh/viem';
import { privateKeyToAccount } from 'https://esm.sh/viem/accounts';

const PAYMENT_ADDRESS = '${paymentAddress}';
const FACILITATOR_ADDRESS = '0xdeE710bB6a3b652C35B5cB74E7bdb03EE1F641E6';
const TOKEN_ADDRESS = '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb';
const RADIUS_RPC = 'https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2';

// BatchTransfer contract for single-tx agent funding (deployed on Radius chain 723)
const BATCH_CONTRACT = '0x71e14b65a8305a9a95a675abccb993f929b53885';

const radius = defineChain({
  id: 723,
  name: 'Radius',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RADIUS_RPC] } },
});

const publicClient = createPublicClient({ chain: radius, transport: http(RADIUS_RPC) });

// ERC-20 ABI fragments
const balanceOfData = (addr) => encodeFunctionData({ abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }], functionName: 'balanceOf', args: [addr] });
const noncesData = (addr) => encodeFunctionData({ abi: [{ name: 'nonces', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }], functionName: 'nonces', args: [addr] });

const decodeUint = (data) => decodeFunctionResult({ abi: [{ name: 'x', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }], functionName: 'x', data });

async function getNonce(addr) {
  const data = await publicClient.call({ to: TOKEN_ADDRESS, data: noncesData(addr) });
  return decodeUint(data.data);
}

async function getBalance(addr) {
  const data = await publicClient.call({ to: TOKEN_ADDRESS, data: balanceOfData(addr) });
  return decodeUint(data.data);
}

// Permit EIP-712 types
const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ]
};
const permitDomain = {
  name: 'Stable Coin',
  version: '1',
  chainId: 723,
  verifyingContract: TOKEN_ADDRESS,
};

// State
let connectedAddress = null;
let swarmRunning = false;

// -- Wallet Connection --
window.connectWallet = async function() {
  const btn = document.getElementById('connectBtn');
  if (!window.ethereum) { alert('MetaMask not found. Please install it.'); return; }
  btn.disabled = true; btn.textContent = 'Connecting...';
  try {
    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    connectedAddress = accounts[0];

    // Add/switch to Radius
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2d3' }] });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2d3',
            chainName: 'Radius',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2'],
          }]
        });
      }
    }

    // Show address
    const short = connectedAddress.slice(0, 6) + '...' + connectedAddress.slice(-4);
    document.getElementById('walletAddr').textContent = short;
    document.getElementById('walletInfo').classList.add('visible');
    btn.textContent = 'Connected';
    document.getElementById('queryBtn').disabled = false;
    checkSwarmReady();

    // Fetch balance
    try {
      const bal = await getBalance(connectedAddress);
      const formatted = (Number(bal) / 1e6).toFixed(4);
      document.getElementById('walletBal').textContent = formatted + ' SBC';
    } catch (e) {
      document.getElementById('walletBal').textContent = '— SBC';
    }
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Connect Wallet';
    console.error(err);
  }
};

// -- Manual Query --
window.runQuery = async function() {
  const ip = document.getElementById('ipInput').value.trim();
  if (!ip) return;
  const statusEl = document.getElementById('queryStatus');
  const resultEl = document.getElementById('queryResult');
  const queryBtn = document.getElementById('queryBtn');
  queryBtn.disabled = true;
  statusEl.className = 'status-msg';
  statusEl.innerHTML = '<span class="spinner"></span>Requesting payment terms...';
  resultEl.classList.remove('visible');

  const t0 = Date.now();
  try {
    const resource = window.location.origin + '/api/threat/' + encodeURIComponent(ip);

    // Step 1: Get 402
    const res402 = await fetch('/api/threat/' + encodeURIComponent(ip));
    if (res402.status !== 402) throw new Error('Expected 402, got ' + res402.status);
    const body402 = await res402.json();
    const req = body402.accepts[0];

    statusEl.innerHTML = '<span class="spinner"></span>Signing permit...';

    // Step 2: Get nonce and sign permit
    const nonce = await getNonce(connectedAddress);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Sign via MetaMask (eth_signTypedData_v4)
    // Spender is the facilitator — it calls permit() then transferFrom()
    const typedData = JSON.stringify({
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        ...permitTypes
      },
      primaryType: 'Permit',
      domain: permitDomain,
      message: {
        owner: connectedAddress,
        spender: FACILITATOR_ADDRESS,
        value: req.maxAmountRequired.toString(),
        nonce: nonce.toString(),
        deadline: deadline.toString(),
      },
    });

    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [connectedAddress, typedData],
    });

    statusEl.innerHTML = '<span class="spinner"></span>Settling payment...';

    // Step 3: Build payment payload
    const paymentPayload = {
      x402Version: 2,
      resource: resource,
      accepted: { scheme: 'exact', network: 'eip155:723' },
      payload: {
        signature: signature,
        authorization: {
          from: connectedAddress,
          to: FACILITATOR_ADDRESS,
          value: req.maxAmountRequired.toString(),
          validAfter: '0',
          validBefore: deadline.toString(),
          nonce: nonce.toString(),
        }
      }
    };
    const xPayment = btoa(JSON.stringify(paymentPayload));

    // Step 4: Retry with payment
    const res = await fetch('/api/threat/' + encodeURIComponent(ip), {
      headers: { 'X-Payment': xPayment }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Payment failed (' + res.status + '): ' + errText);
    }
    const data = await res.json();
    const elapsed = Date.now() - t0;

    // Display
    document.getElementById('queryJson').innerHTML = syntaxHighlight(data);
    document.getElementById('resultTime').textContent = elapsed + 'ms';
    resultEl.classList.add('visible');
    statusEl.textContent = '';

    // Curl
    document.getElementById('curlCmd').textContent =
      'curl -H "X-Payment: ' + xPayment.slice(0, 40) + '..." ' + resource;

  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = err.message;
    console.error(err);
  } finally {
    queryBtn.disabled = false;
  }
};

window.copyCurl = function() {
  const text = document.getElementById('curlCmd').textContent;
  navigator.clipboard.writeText(text);
  const btn = document.querySelector('.curl-block .copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
};

// -- Swarm Demo --
let swarmAbort = false;

// Semaphore: limits concurrent facilitator settlements
function createSemaphore(max) {
  let current = 0;
  const queue = [];
  return {
    async acquire() {
      if (current < max) { current++; return; }
      await new Promise(resolve => queue.push(resolve));
      current++;
    },
    release() {
      current--;
      if (queue.length > 0) queue.shift()();
    }
  };
}

// ERC-20 transfer(address,uint256) function
const transferData = (to, amount) => encodeFunctionData({
  abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' }],
  functionName: 'transfer',
  args: [to, amount]
});

// ERC-20 approve(address,uint256)
const approveData = (spender, amount) => encodeFunctionData({
  abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' }],
  functionName: 'approve',
  args: [spender, amount]
});

// BatchTransfer.batchTransfer(address,address[],uint256[])
const batchTransferCallData = (token, recipients, amounts) => encodeFunctionData({
  abi: [{ name: 'batchTransfer', type: 'function', inputs: [{ name: 'token', type: 'address' }, { name: 'recipients', type: 'address[]' }, { name: 'amounts', type: 'uint256[]' }], outputs: [], stateMutability: 'nonpayable' }],
  functionName: 'batchTransfer',
  args: [token, recipients, amounts]
});

window.updateCost = function() {
  const agents = parseInt(document.getElementById('swarmAgents').value) || 1;
  const perAgent = parseInt(document.getElementById('swarmCount').value) || 1;
  const totalUnits = agents * perAgent * 100; // 100 units per request
  const sbc = (totalUnits / 1e6).toFixed(4);
  document.getElementById('swarmCost').textContent = sbc + ' SBC';
};

// Enable swarm button when wallet is connected
function checkSwarmReady() {
  const btn = document.getElementById('swarmBtn');
  if (btn) btn.disabled = !connectedAddress;
}

window.launchSwarm = async function() {
  if (!connectedAddress) return;
  const numAgents = Math.min(10, Math.max(1, parseInt(document.getElementById('swarmAgents').value) || 5));
  const perAgent = Math.max(1, parseInt(document.getElementById('swarmCount').value) || 20);
  const amountPerAgent = BigInt(perAgent) * BigInt(100); // 100 units per request
  const statusEl = document.getElementById('swarmStatus');

  swarmAbort = false;
  statusEl.className = 'status-msg';
  statusEl.innerHTML = '<span class="spinner"></span>Generating ' + numAgents + ' agent wallets...';

  // Step 1: Generate ephemeral wallets
  const agents = [];
  for (let i = 0; i < numAgents; i++) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const account = privateKeyToAccount(hex);
    agents.push({ account, key: hex });
  }

  // Step 2: Approve BatchTransfer contract to spend SBC tokens
  const totalFunding = amountPerAgent * BigInt(numAgents);
  statusEl.innerHTML = '<span class="spinner"></span>Approving batch funding... Confirm in MetaMask.';
  try {
    const approveTxHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: connectedAddress,
        to: TOKEN_ADDRESS,
        data: approveData(BATCH_CONTRACT, totalFunding),
      }]
    });
    statusEl.innerHTML = '<span class="spinner"></span>Waiting for approval tx...';
    await waitForTx(approveTxHash);
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = 'Approval failed: ' + (err.message || err);
    return;
  }

  // Step 4: Batch fund all agents in a single tx
  const recipients = agents.map(a => a.account.address);
  const amounts = agents.map(() => amountPerAgent);
  statusEl.innerHTML = '<span class="spinner"></span>Batch funding ' + numAgents + ' agents... Confirm in MetaMask.';
  try {
    const batchTxHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: connectedAddress,
        to: BATCH_CONTRACT,
        data: batchTransferCallData(TOKEN_ADDRESS, recipients, amounts),
      }]
    });
    statusEl.innerHTML = '<span class="spinner"></span>Waiting for batch funding tx...';
    await waitForTx(batchTxHash);
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = 'Batch funding failed: ' + (err.message || err);
    return;
  }

  // Step 5: Run the swarm
  swarmRunning = true;
  document.getElementById('swarmBtn').style.display = 'none';
  document.getElementById('swarmStop').style.display = '';
  document.getElementById('swarmStats').style.display = '';
  document.getElementById('swarmLog').classList.add('visible');
  document.getElementById('swarmLog').innerHTML = '';
  statusEl.innerHTML = '<span class="spinner"></span>Swarm active!';

  let totalReqs = 0, totalSpent = 0, totalLatency = 0;
  const startTime = Date.now();

  const randomIPs = (count) => {
    const ips = [];
    for (let i = 0; i < count; i++) {
      ips.push(Math.floor(Math.random()*223+1) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256));
    }
    return ips;
  };

  function updateStats() {
    document.getElementById('statTotal').textContent = totalReqs;
    document.getElementById('statSpent').textContent = (totalSpent / 1e6).toFixed(4);
    const elapsed = (Date.now() - startTime) / 1000;
    document.getElementById('statRps').textContent = elapsed > 0 ? (totalReqs / elapsed).toFixed(1) : '0';
    document.getElementById('statLatency').textContent = totalReqs > 0 ? Math.round(totalLatency / totalReqs) : '0';
  }

  function log(agentIdx, ip, msg, isError) {
    const el = document.getElementById('swarmLog');
    const entry = document.createElement('div');
    entry.className = 'entry';
    entry.innerHTML = '<span class="' + (isError ? 'err' : 'ok') + '">Agent ' + (agentIdx+1) + '</span> \\u2192 ' + ip + ' \\u2192 ' + msg;
    el.appendChild(entry);
    el.scrollTop = el.scrollHeight;
  }

  // Serialize facilitator settlements (facilitator can only reliably handle 1 at a time)
  const settle = createSemaphore(1);

  const agentWork = async (agent, agentIdx) => {
    const account = agent.account;
    const ips = randomIPs(perAgent);

    // Fetch initial nonce once, then increment locally
    let currentNonce = await getNonce(account.address);

    for (let i = 0; i < ips.length; i++) {
      if (swarmAbort) return;
      const ip = ips[i];
      const t0 = Date.now();
      let success = false;

      // Retry up to 3 times on facilitator failures
      for (let attempt = 0; attempt < 3 && !success && !swarmAbort; attempt++) {
        try {
          const resource = window.location.origin + '/api/threat/' + encodeURIComponent(ip);

          // Re-fetch permit nonce on retries in case facilitator consumed it but returned an error
          if (attempt > 0) {
            try { currentNonce = await getNonce(account.address); } catch(e) {}
          }

          // Sign permit with in-memory key (no MetaMask popup)
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

          const signature = await account.signTypedData({
            domain: permitDomain,
            types: permitTypes,
            primaryType: 'Permit',
            message: {
              owner: account.address,
              spender: FACILITATOR_ADDRESS,
              value: BigInt(100),
              nonce: currentNonce,
              deadline: deadline,
            },
          });

          const paymentPayload = {
            x402Version: 2,
            resource: resource,
            accepted: { scheme: 'exact', network: 'eip155:723' },
            payload: {
              signature: signature,
              authorization: {
                from: account.address,
                to: FACILITATOR_ADDRESS,
                value: '100',
                validAfter: '0',
                validBefore: deadline.toString(),
                nonce: currentNonce.toString(),
              }
            }
          };
          const xPayment = btoa(JSON.stringify(paymentPayload));

          // Acquire semaphore before hitting facilitator
          await settle.acquire();
          let res;
          try {
            res = await fetch('/api/threat/' + encodeURIComponent(ip), {
              headers: { 'X-Payment': xPayment }
            });
          } finally {
            // Brief delay before releasing semaphore to let facilitator finalize state
            await new Promise(r => setTimeout(r, 150));
            settle.release();
          }

          if (!res.ok) {
            if (attempt < 2) {
              // Wait before retry with exponential backoff
              await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
              continue;
            }
            const errBody = await res.text().catch(() => '');
            throw new Error('HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 120) : ''));
          }

          const data = await res.json();
          const elapsed = Date.now() - t0;

          currentNonce = currentNonce + BigInt(1);
          success = true;

          totalReqs++;
          totalSpent += 100;
          totalLatency += elapsed;
          updateStats();
          log(agentIdx, ip, 'score: ' + data.threat_score + ' \\u2192 0.0001 SBC \\u2192 ' + elapsed + 'ms', false);
        } catch (err) {
          if (attempt >= 2) {
            const elapsed = Date.now() - t0;
            totalLatency += elapsed;
            log(agentIdx, ip, err.message, true);
            // Re-fetch nonce from chain in case it drifted
            try { currentNonce = await getNonce(account.address); } catch(e) {}
          }
        }
      }
    }
  };

  // Stagger agent starts (300ms apart) to avoid thundering herd
  const promises = agents.map((agent, idx) =>
    new Promise(r => setTimeout(r, idx * 300)).then(() => agentWork(agent, idx))
  );
  await Promise.all(promises);

  swarmRunning = false;
  document.getElementById('swarmBtn').style.display = '';
  document.getElementById('swarmStop').style.display = 'none';
  if (!swarmAbort) {
    statusEl.textContent = 'Swarm complete. ' + totalReqs + ' requests, ' + (totalSpent / 1e6).toFixed(4) + ' SBC spent.';
    // Refresh main wallet balance
    try {
      const bal = await getBalance(connectedAddress);
      document.getElementById('walletBal').textContent = (Number(bal) / 1e6).toFixed(4) + ' SBC';
    } catch(e) {}
  }
};

async function waitForTx(txHash) {
  for (let i = 0; i < 60; i++) {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null);
    if (receipt) {
      if (receipt.status === 'reverted') throw new Error('Transaction reverted');
      return receipt;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Transaction not confirmed after 60s');
}

window.stopSwarm = function() {
  swarmAbort = true;
  document.getElementById('swarmStatus').textContent = 'Stopping...';
  document.getElementById('swarmBtn').style.display = '';
  document.getElementById('swarmStop').style.display = 'none';
};

function syntaxHighlight(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, (match) => {
    let cls = 'json-num';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-str';
    } else if (/true|false/.test(match)) {
      cls = 'json-bool';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}
</script>
</body>
</html>`;
}
