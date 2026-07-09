// Supabase Edge Function (Deno) — Phase 6b: Google Drive token refresh.
//
// Mints a fresh, short-lived Google access token from a long-lived refresh token so the app can keep
// syncing to Drive WITHOUT forcing the user to sign in again every ~hour. Supabase does not refresh
// Google provider tokens itself, and the exchange needs the Google **client secret** — which must
// never ship in the app bundle. So it lives here (a Supabase function secret) and the app calls this
// function instead.
//
// Flow: app sends its stored Google `refresh_token` (+ its Supabase JWT, which the platform verifies)
// → this function exchanges it at Google's token endpoint using client_id + client_secret
// → returns a fresh `access_token`.
//
// Deploy:
//   npx supabase functions deploy google-token-refresh --project-ref <your-project-ref>
// Secrets (set once):
//   npx supabase secrets set GOOGLE_CLIENT_ID=<...> GOOGLE_CLIENT_SECRET=<...>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let refreshToken: string | undefined;
  try {
    const body = await req.json();
    refreshToken = body?.refresh_token;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!refreshToken) return json({ error: 'missing_refresh_token' }, 400);

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json({ error: 'server_not_configured' }, 500);

  const googleRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await googleRes.json();
  if (!googleRes.ok) {
    // e.g. `invalid_grant` when the refresh token was revoked → the app should prompt a re-login.
    return json({ error: data.error ?? 'refresh_failed' }, googleRes.status);
  }

  return json({ access_token: data.access_token, expires_in: data.expires_in });
});
