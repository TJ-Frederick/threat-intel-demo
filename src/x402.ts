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
  /** Chain identifier, e.g. "eip155:723" (Radius) */
  network: string;
  /** Wallet address that receives payments */
  payTo: string;
  /** Facilitator service base URL (e.g. "https://facilitator.andrs.dev") */
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

    const verifyData: any = await verifyRes.json();
    if (!verifyData.isValid) {
      return { status: 'verify-failed', detail: verifyData };
    }
  }

  // Step 5a: Async settle — fire-and-forget, return immediately
  if (options?.asyncSettle) {
    const settlePromise = fetch(`${config.facilitatorUrl}/settle`, settleOpts)
      .then((r) => r.json())
      .catch(() => {});
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

  const settleData: any = await settleRes.json();
  if (!settleData.success) {
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
