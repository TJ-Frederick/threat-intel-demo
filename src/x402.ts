/**
 * x402 Payment Module
 *
 * Implements the x402 HTTP payment protocol for Cloudflare Workers.
 * Uses a facilitator service for ERC-2612 permit-based token transfers.
 *
 * Flow:
 *   1. Client requests a paid endpoint without payment → server returns 402 with requirements
 *   2. Client signs an ERC-2612 permit and sends it in the X-Payment header (base64-encoded)
 *   3. Server forwards the permit to a facilitator for verification and on-chain settlement
 *   4. Server returns the requested data after successful settlement
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Configuration for x402 payment gating. One per app. */
export interface X402Config {
  /** ERC-20 token contract address */
  asset: string;
  /** Chain identifier, e.g. "eip155:72344" */
  network: string;
  /** Wallet address that receives payments */
  payTo: string;
  /** Facilitator service base URL */
  facilitatorUrl: string;
  /** Payment amount in raw token units (e.g. "100" = 0.0001 with 6 decimals) */
  amount: string;
  /** Optional API key for the facilitator */
  facilitatorApiKey?: string;
  /** ERC-2612 permit domain name (default: "Stable Coin") */
  tokenName?: string;
  /** ERC-2612 permit domain version (default: "1") */
  tokenVersion?: string;
  /** HTTP header name carrying the payment (default: "X-Payment") */
  paymentHeader?: string;
}

/** Options for processPayment behavior */
export interface PaymentOptions {
  /** Skip the verify step, go straight to settle */
  skipVerify?: boolean;
  /** Fire-and-forget settle: return before settlement confirms (requires ExecutionContext) */
  asyncSettle?: boolean;
}

/** A single payment requirement in the 402 response (x402 v2) */
export interface PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: string;
    version: string;
    assetTransferMethod?: string;
  };
}

/** The full 402 response body (x402 v2) */
export interface PaymentRequirementsResponse {
  paymentRequirements: PaymentRequirement[];
  x402Version: number;
}

/** Every possible outcome of processPayment */
export type PaymentOutcome =
  | { status: 'no-payment'; requirements: PaymentRequirementsResponse }
  | { status: 'invalid-header' }
  | { status: 'verify-failed'; detail: any }
  | { status: 'verify-unreachable'; detail: string }
  | { status: 'settle-failed'; detail: any }
  | { status: 'settle-unreachable'; detail: string }
  | {
      status: 'settled';
      txHash: string | undefined;
      verifyMs: number;
      settleMs: number;
      totalMs: number;
    }
  | {
      status: 'settle-pending';
      verifyMs: number;
      totalMs: number;
    };

interface FacilitatorResponseDetails {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  contentType: string | null;
  data: any | null;
  text: string;
  parseError?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build the 402 response body describing what payment the server accepts (x402 v2). */
export function buildPaymentRequirements(
  config: X402Config,
): PaymentRequirementsResponse {
  return {
    paymentRequirements: [
      {
        scheme: 'exact',
        network: config.network,
        amount: config.amount,
        asset: config.asset,
        payTo: config.payTo,
        maxTimeoutSeconds: 300,
        extra: {
          name: config.tokenName ?? 'Stable Coin',
          version: config.tokenVersion ?? '1',
          assetTransferMethod: 'permit2',
        },
      },
    ],
    x402Version: 2,
  };
}

/** Standard CORS headers that include the payment header. */
export function corsHeaders(config?: Partial<X402Config>): Record<string, string> {
  const header = config?.paymentHeader ?? 'X-Payment';
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': `Content-Type, ${header}`,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

/** JSON response with CORS headers. */
export function jsonResponse(
  data: unknown,
  status = 200,
  config?: Partial<X402Config>,
): Response {
  return Response.json(data, {
    status,
    headers: { ...corsHeaders(config), 'Content-Type': 'application/json' },
  });
}

async function readFacilitatorResponse(res: Response): Promise<FacilitatorResponseDetails> {
  const text = await res.text();
  const contentType = res.headers.get('content-type');

  if (!text) {
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      contentType,
      data: null,
      text: '',
    };
  }

  try {
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      contentType,
      data: JSON.parse(text),
      text,
    };
  } catch (error: any) {
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      contentType,
      data: null,
      text,
      parseError: error?.message ?? String(error),
    };
  }
}

function logFacilitatorFailure(
  phase: 'verify' | 'settle',
  config: X402Config,
  details: FacilitatorResponseDetails,
) {
  console.error(
    JSON.stringify({
      event: `facilitator_${phase}_failure`,
      facilitatorUrl: config.facilitatorUrl,
      network: config.network,
      upstream: details,
    }),
  );
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Run the full x402 payment flow against a facilitator.
 *
 * 1. Checks for the payment header on the incoming request.
 * 2. If missing, returns 'no-payment' with 402 requirements.
 * 3. Decodes and parses the base64-encoded X-Payment header.
 * 4. Sends the permit to the facilitator for verification (unless skipVerify).
 * 5. Sends the permit to the facilitator for on-chain settlement.
 * 6. Returns 'settled' with the transaction hash and timing metrics.
 *
 * @param config    - x402 configuration (asset, network, facilitator, etc.)
 * @param request   - the incoming HTTP request
 * @param resource  - the URL being paid for (included in 402 requirements)
 * @param description - human-readable description of what's being paid for
 * @param options   - optional: skipVerify, asyncSettle
 * @param ctx       - ExecutionContext, required for asyncSettle mode
 */
export async function processPayment(
  config: X402Config,
  request: Request,
  resource: string,
  description: string,
  options?: PaymentOptions,
  ctx?: ExecutionContext,
): Promise<PaymentOutcome> {
  const headerName = config.paymentHeader ?? 'X-Payment';
  const paymentHeader = request.headers.get(headerName);

  // Step 1: No payment header → return requirements for 402 response
  if (!paymentHeader) {
    return {
      status: 'no-payment',
      requirements: buildPaymentRequirements(config),
    };
  }

  // Step 2: Decode the base64-encoded payment payload
  let paymentPayload: any;
  try {
    paymentPayload = JSON.parse(atob(paymentHeader));
  } catch {
    return { status: 'invalid-header' };
  }

  // Step 3: Build the facilitator request
  const facilitatorHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.facilitatorApiKey) {
    facilitatorHeaders['X-API-Key'] = config.facilitatorApiKey;
  }

  const facilitatorBody = JSON.stringify({
    x402Version: 2,
    paymentPayload: paymentPayload,
    paymentRequirements: buildPaymentRequirements(config).paymentRequirements[0],
  });

  const settleOpts = {
    method: 'POST',
    headers: facilitatorHeaders,
    body: facilitatorBody,
  };

  const t0 = Date.now();
  let verifyMs = 0;

  // Step 4: Verify with facilitator (unless skipVerify)
  if (!options?.skipVerify) {
    let verifyRes: Response;
    try {
      verifyRes = await fetch(`${config.facilitatorUrl}/verify`, {
        method: 'POST',
        headers: facilitatorHeaders,
        body: facilitatorBody,
      });
    } catch (e: any) {
      return { status: 'verify-unreachable', detail: e.message };
    }
    verifyMs = Date.now() - t0;

    const verifyDetails = await readFacilitatorResponse(verifyRes);
    if (!verifyDetails.data) {
      logFacilitatorFailure('verify', config, verifyDetails);
      return {
        status: 'verify-failed',
        detail: {
          error: 'Facilitator returned a non-JSON verify response',
          ...verifyDetails,
        },
      };
    }

    const verifyData: any = verifyDetails.data;
    if (!verifyData.isValid) {
      logFacilitatorFailure('verify', config, verifyDetails);
      return { status: 'verify-failed', detail: verifyData };
    }
  }

  // Step 5a: Async settle — fire-and-forget, return immediately
  if (options?.asyncSettle) {
    const settlePromise = fetch(`${config.facilitatorUrl}/settle`, settleOpts)
      .then(async (res) => {
        const settleDetails = await readFacilitatorResponse(res);
        if (!settleDetails.ok || !settleDetails.data?.success) {
          logFacilitatorFailure('settle', config, settleDetails);
        }
      })
      .catch((error: any) => {
        console.error(
          JSON.stringify({
            event: 'facilitator_settle_unreachable',
            facilitatorUrl: config.facilitatorUrl,
            network: config.network,
            error: error?.message ?? String(error),
          }),
        );
      });
    if (ctx) ctx.waitUntil(settlePromise);

    return {
      status: 'settle-pending',
      verifyMs,
      totalMs: Date.now() - t0,
    };
  }

  // Step 5b: Synchronous settle — wait for confirmation
  const t1 = Date.now();
  let settleRes: Response;
  try {
    settleRes = await fetch(`${config.facilitatorUrl}/settle`, settleOpts);
  } catch (e: any) {
    return { status: 'settle-unreachable', detail: e.message };
  }
  const settleMs = Date.now() - t1;

  const settleDetails = await readFacilitatorResponse(settleRes);
  if (!settleDetails.data) {
    logFacilitatorFailure('settle', config, settleDetails);
    return {
      status: 'settle-failed',
      detail: {
        error: 'Facilitator returned a non-JSON settle response',
        ...settleDetails,
      },
    };
  }

  const settleData: any = settleDetails.data;
  if (!settleData.success) {
    logFacilitatorFailure('settle', config, settleDetails);
    return { status: 'settle-failed', detail: settleData };
  }

  const txHash =
    settleData.transaction ||
    settleData.txHash ||
    settleData.transactionHash ||
    settleData.hash;

  return {
    status: 'settled',
    txHash,
    verifyMs,
    settleMs,
    totalMs: Date.now() - t0,
  };
}
