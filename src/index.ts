import { createHandle, syncPolicy } from '@radiustech/platform-sdk';
export { RadiusCounter } from '@radiustech/platform-sdk/limiters/do';

import { getFrontendHtml } from './frontend';
import {
  getNetworkKeyFromUrl,
  getPublicNetworkConfigs,
  type Env,
  type NetworkKey,
  type PublicNetworkConfig,
} from './network-config';
import { getSwarmModuleJs } from './swarm';
import { corsHeaders, decodePaymentResponse, jsonResponse, withCors } from './http';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#f6821f"/>
  <path d="M32 14L18 24v12l14 16 14-16V24L32 14z" fill="#fff" opacity="0.96"/>
  <path d="M32 14l14 10v12L32 52V14z" fill="#fff" opacity="0.76"/>
  <circle cx="32" cy="32" r="5.75" fill="#f6821f"/>
</svg>`;

// Deterministic hash from IP string
function hashIP(ip: string): number {
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 9301) * 10000;
  return x - Math.floor(x);
}

/** The threat report itself. Payment details are added after the gate settles (see addReceipt). */
function generateThreatData(ip: string, networkKey: NetworkKey, networkConfig: PublicNetworkConfig) {
  const seed = hashIP(ip);

  const categories = ['scanner', 'scraper', 'proxy', 'tor_exit', 'residential', 'datacenter', 'vpn'];
  const countries = ['US', 'CN', 'RU', 'DE', 'BR', 'NL', 'RO', 'UA', 'IN', 'KR'];
  const isps = [
    'DigitalOcean LLC', 'OVH SAS', 'Amazon AWS', 'Hetzner Online',
    'Linode LLC', 'Vultr Holdings', 'Google Cloud', 'Microsoft Azure',
    'Cloudflare Inc', 'Alibaba Cloud',
  ];

  const threatScore = Math.floor(seededRandom(seed, 0) * 101);
  const botProb = Math.round(seededRandom(seed, 1) * 100) / 100;

  // Pick 1-3 categories
  const numCats = 1 + Math.floor(seededRandom(seed, 2) * 3);
  const pickedCats: string[] = [];
  for (let i = 0; i < numCats; i++) {
    const idx = Math.floor(seededRandom(seed, 3 + i) * categories.length);
    const cat = categories[idx];
    if (!pickedCats.includes(cat)) pickedCats.push(cat);
  }

  const country = countries[Math.floor(seededRandom(seed, 10) * countries.length)];
  const isp = isps[Math.floor(seededRandom(seed, 11) * isps.length)];

  // Seeded recent date (within last 90 days)
  const daysAgo = Math.floor(seededRandom(seed, 12) * 90);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const firstSeen = d.toISOString().split('T')[0];

  return {
    ip,
    threat_score: threatScore,
    bot_probability: botProb,
    categories: pickedCats,
    country,
    isp,
    first_seen: firstSeen,
    request_cost: '$0.0001',
    settlement_network: networkConfig.label,
    settlement_network_key: networkKey,
  };
}

/** Which Radius Platform project enforces payments for a network. */
function projectIdFor(env: Env, networkKey: NetworkKey): string | undefined {
  return networkKey === 'testnet' ? env.RADIUS_PROJECT_ID_TESTNET : env.RADIUS_PROJECT_ID_MAINNET;
}

/** The gate: decides each request under the selected project's policy (free, 402, verify, settle). */
// noPolicy: 'deny' — until the first policy sync lands, answer 503 rather than serve paid
// routes for free (the SDK's default is to allow).
const gate = createHandle<Env>({ noPolicy: 'deny' });

/**
 * The gate settles *after* our handler has produced the body, so the transaction hash and timings
 * can only be known here. To keep the response shape the frontend already renders, they are
 * merged back into the JSON body.
 */
async function addReceipt(
  response: Response,
  networkConfig: PublicNetworkConfig,
  timings: { verifyMs: number; settleMs: number; totalMs: number },
): Promise<Response> {
  const settlement = decodePaymentResponse(response.headers.get('PAYMENT-RESPONSE'));
  if (response.status !== 200 || !settlement?.success) return response;

  const data = await response.json<Record<string, unknown>>();
  const txHash = settlement.transaction;
  const merged = {
    ...data,
    settlement_time_ms: timings.totalMs,
    verify_ms: timings.verifyMs,
    settle_ms: timings.settleMs,
    ...(txHash ? { tx_hash: txHash, tx_explorer_url: `${networkConfig.explorerBaseUrl}/tx/${txHash}` } : {}),
  };
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(merged), { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const networkKey = getNetworkKeyFromUrl(url);
    const networkConfig = getPublicNetworkConfigs(env)[networkKey];

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const projectId = projectIdFor(env, networkKey);
    if (!projectId) {
      return jsonResponse({ error: `No Radius project configured for ${networkKey}` }, 500);
    }

    // Point the gate at this network's project. Everything else (API key, KV, limiter) is shared.
    const gateEnv: Env = { ...env, RADIUS_PROJECT_ID: projectId };

    const started = Date.now();
    let handlerStarted = 0;
    let handlerFinished = 0;

    const response = await gate(
      request,
      gateEnv,
      async (forwarded) => {
        handlerStarted = Date.now();
        const res = await route(forwarded, env, networkKey, networkConfig);
        handlerFinished = Date.now();
        return res;
      },
      ctx,
    );

    const finished = Date.now();
    const timings = {
      verifyMs: handlerStarted ? handlerStarted - started : 0,
      settleMs: handlerFinished ? finished - handlerFinished : 0,
      totalMs: finished - started,
    };

    return withCors(await addReceipt(response, networkConfig, timings));
  },

  /** Cron: keep both projects' policies synced into KV. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const key of ['testnet', 'mainnet'] as const) {
      const projectId = projectIdFor(env, key);
      if (projectId) ctx.waitUntil(syncPolicy({ ...env, RADIUS_PROJECT_ID: projectId }));
    }
  },
};

/** The app's own routes. Payment is already handled by the gate before these run. */
async function route(
  request: Request,
  env: Env,
  networkKey: NetworkKey,
  networkConfig: PublicNetworkConfig,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    return jsonResponse({ status: 'ok', network: networkKey });
  }

  // Swarm module (reusable browser-side agent orchestration)
  if (url.pathname === '/modules/swarm.js') {
    return new Response(getSwarmModuleJs(), {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  if (url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico') {
    return new Response(FAVICON_SVG, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // Threat intel endpoint: charged $0.0001 by the Radius Platform policy.
  const threatMatch = url.pathname.match(/^\/api\/threat\/(.+)$/);
  if (threatMatch) {
    const ip = decodeURIComponent(threatMatch[1]);
    return jsonResponse(generateThreatData(ip, networkKey, networkConfig));
  }

  // Frontend
  if (url.pathname === '/' || url.pathname === '') {
    const boot = {
      defaultNetwork: networkKey,
      networks: getPublicNetworkConfigs(env),
    };
    return new Response(getFrontendHtml(boot), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
