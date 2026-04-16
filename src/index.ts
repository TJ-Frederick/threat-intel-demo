import { getFrontendHtml } from './frontend';
import {
  getNetworkKeyFromUrl,
  getPublicNetworkConfigs,
  getWorkerNetworkConfigs,
  toX402Config,
  type Env,
  type NetworkKey,
  type WorkerNetworkConfig,
} from './network-config';
import { getSwarmModuleJs } from './swarm';
import { processPayment, corsHeaders, jsonResponse } from './x402';

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

function generateThreatData(
  ip: string,
  networkKey: NetworkKey,
  networkConfig: WorkerNetworkConfig,
  settlementMs: number,
  verifyMs: number,
  settleMs: number,
  txHash?: string,
) {
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
    settlement_time_ms: settlementMs,
    verify_ms: verifyMs,
    settle_ms: settleMs,
    ...(txHash
      ? {
          tx_hash: txHash,
          tx_explorer_url: `${networkConfig.explorerBaseUrl}/tx/${txHash}`,
        }
      : {}),
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const networkKey = getNetworkKeyFromUrl(url);
    const networkConfig = getWorkerNetworkConfigs(env)[networkKey];
    const config = toX402Config(networkConfig);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(config) });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', network: networkKey }, 200, config);
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

    // Threat intel endpoint
    const threatMatch = url.pathname.match(/^\/api\/threat\/(.+)$/);
    if (threatMatch) {
      const ip = decodeURIComponent(threatMatch[1]);

      const outcome = await processPayment(
        config,
        request,
        url.toString(),
        `Threat intel query for ${ip}`,
        {
          skipVerify: url.searchParams.get('fast') === '1',
          asyncSettle: url.searchParams.get('async') === '1',
        },
        ctx,
      );

      switch (outcome.status) {
        case 'no-payment':
          return jsonResponse(outcome.requirements, 402, config);
        case 'invalid-header':
          return jsonResponse({ error: 'Invalid X-Payment header' }, 400, config);
        case 'verify-failed':
          return jsonResponse({ error: 'Payment verification failed', detail: outcome.detail }, 402, config);
        case 'verify-unreachable':
          return jsonResponse({ error: 'Facilitator verify unreachable', detail: outcome.detail }, 502, config);
        case 'settle-failed':
          return jsonResponse({ error: 'Payment settlement failed', detail: outcome.detail }, 402, config);
        case 'settle-unreachable':
          return jsonResponse({ error: 'Facilitator settle unreachable', detail: outcome.detail }, 502, config);
        case 'settle-pending': {
          const data = generateThreatData(
            ip,
            networkKey,
            networkConfig,
            outcome.totalMs,
            outcome.verifyMs,
            0,
          );
          return jsonResponse(data, 200, config);
        }
        case 'settled': {
          const data = generateThreatData(
            ip,
            networkKey,
            networkConfig,
            outcome.totalMs,
            outcome.verifyMs,
            outcome.settleMs,
            outcome.txHash,
          );
          return jsonResponse(data, 200, config);
        }
        default: {
          const _exhaustive: never = outcome;
          return jsonResponse({ error: 'Unexpected payment state' }, 500, config);
        }
      }
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

    return jsonResponse({ error: 'Not found' }, 404, config);
  },
};
