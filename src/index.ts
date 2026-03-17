import { getFrontendHtml } from './frontend';

interface Env {
  PAYMENT_ADDRESS: string;
  FACILITATOR_API_KEY?: string;
}

const TOKEN_ADDRESS = '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb';
const FACILITATOR_URL = 'https://facilitator.andrs.dev';
const AMOUNT = '100'; // 0.0001 SBC (6 decimals)

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

function generateThreatData(ip: string, settlementMs: number, verifyMs: number, settleMs: number, txHash?: string) {
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
    settlement_network: 'Radius',
    settlement_time_ms: settlementMs,
    verify_ms: verifyMs,
    settle_ms: settleMs,
    ...(txHash ? { tx_hash: txHash } : {}),
  };
}

function getPaymentRequirements(resource: string, ip: string, paymentAddress: string) {
  return {
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:723',
        maxAmountRequired: AMOUNT,
        resource,
        description: `Threat intel query for ${ip}`,
        payTo: paymentAddress,
        maxTimeoutSeconds: 300,
        asset: TOKEN_ADDRESS,
        extra: {
          assetTransferMethod: 'erc2612',
          name: 'Stable Coin',
          version: '1',
        },
      },
    ],
    x402Version: 2,
  };
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Payment',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok' }, { headers: corsHeaders() });
    }

    // Threat intel endpoint
    const threatMatch = url.pathname.match(/^\/api\/threat\/(.+)$/);
    if (threatMatch) {
      const ip = decodeURIComponent(threatMatch[1]);
      const resource = url.toString();
      const paymentAddress = env.PAYMENT_ADDRESS;

      const paymentHeader = request.headers.get('X-Payment');

      // No payment → 402
      if (!paymentHeader) {
        const requirements = getPaymentRequirements(resource, ip, paymentAddress);
        return Response.json(requirements, {
          status: 402,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }

      // Decode payment
      let paymentPayload: any;
      try {
        paymentPayload = JSON.parse(atob(paymentHeader));
      } catch {
        return Response.json({ error: 'Invalid X-Payment header' }, {
          status: 400,
          headers: corsHeaders(),
        });
      }

      const paymentRequirements = getPaymentRequirements(resource, ip, paymentAddress);

      // Build facilitator headers
      const facilitatorHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (env.FACILITATOR_API_KEY) {
        facilitatorHeaders['X-API-Key'] = env.FACILITATOR_API_KEY;
      }

      const auth = paymentPayload?.payload?.authorization || {};
      const req = paymentRequirements.accepts[0];
      const facilitatorBody = JSON.stringify({
        payload: {
          scheme: 'eip2612',
          from: auth.from,
          to: auth.to,
          value: auth.value,
          validAfter: auth.validAfter,
          validBefore: auth.validBefore,
          nonce: auth.nonce,
        },
        requirements: {
          tokenAddress: req.asset,
          amount: req.maxAmountRequired,
          recipient: req.payTo,
          network: req.network,
        },
        signature: paymentPayload?.payload?.signature,
      });

      // Optimization flags:
      //   ?fast=1  — skip verify, go straight to settle
      //   ?async=1 — fire-and-forget settle (return data before settlement confirms)
      const skipVerify = url.searchParams.get('fast') === '1';
      const asyncSettle = url.searchParams.get('async') === '1';

      // Verify (unless ?fast=1)
      const t0 = Date.now();
      let verifyMs = 0;
      if (!skipVerify) {
        let verifyRes: Response;
        try {
          verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
            method: 'POST',
            headers: facilitatorHeaders,
            body: facilitatorBody,
          });
        } catch (e: any) {
          return Response.json({ error: 'Facilitator verify unreachable', detail: e.message }, {
            status: 502,
            headers: corsHeaders(),
          });
        }
        verifyMs = Date.now() - t0;

        const verifyData: any = await verifyRes.json();
        if (!verifyData.isValid) {
          return Response.json({ error: 'Payment verification failed', detail: verifyData }, {
            status: 402,
            headers: corsHeaders(),
          });
        }
      }

      // Settle
      const settleOpts = {
        method: 'POST',
        headers: facilitatorHeaders,
        body: facilitatorBody,
      };

      // Fire-and-forget mode: start settle but return data immediately
      if (asyncSettle) {
        const settlePromise = fetch(`${FACILITATOR_URL}/settle`, settleOpts)
          .then(r => r.json())
          .catch(() => {});
        ctx.waitUntil(settlePromise);

        const settlementMs = Date.now() - t0;
        const data = generateThreatData(ip, settlementMs, verifyMs, 0);
        (data as any)._mode = 'async';
        return Response.json(data, {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }

      // Synchronous settle (default)
      const t1 = Date.now();
      let settleRes: Response;
      try {
        settleRes = await fetch(`${FACILITATOR_URL}/settle`, settleOpts);
      } catch (e: any) {
        return Response.json({ error: 'Facilitator settle unreachable', detail: e.message }, {
          status: 502,
          headers: corsHeaders(),
        });
      }
      const settleMs = Date.now() - t1;

      const settleData: any = await settleRes.json();
      if (!settleData.success) {
        return Response.json({ error: 'Payment settlement failed', detail: settleData }, {
          status: 402,
          headers: corsHeaders(),
        });
      }

      const settlementMs = Date.now() - t0;
      const txHash = settleData.transaction || settleData.txHash || settleData.transactionHash || settleData.hash;
      const data = generateThreatData(ip, settlementMs, verifyMs, settleMs, txHash);
      // Debug: include full settle response for latency investigation
      (data as any)._settle_response = settleData;
      if (skipVerify) (data as any)._mode = 'fast';

      return Response.json(data, {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Frontend
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(getFrontendHtml(env.PAYMENT_ADDRESS), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  },
};
