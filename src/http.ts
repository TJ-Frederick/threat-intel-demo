/** Small HTTP helpers shared by the Worker's routes. */

/** CORS headers. The x402 v2 headers must be exposed so a browser on another origin can read them. */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, PAYMENT-SIGNATURE',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After',
  };
}

/** JSON response with CORS headers. */
export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

/** Copies a response, adding CORS headers. */
export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Decodes the base64 JSON settlement the gate puts in PAYMENT-RESPONSE. */
export function decodePaymentResponse(header: string | null): { success?: boolean; transaction?: string; network?: string; payer?: string } | null {
  if (!header) return null;
  try {
    return JSON.parse(atob(header));
  } catch {
    return null;
  }
}
