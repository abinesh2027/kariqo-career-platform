import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

export function getAdmin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

export async function getSignedInUser(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

export function razorpayAuth() {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !secret) throw new Error('Razorpay is not connected yet. Add its API key ID and secret in Supabase Function Secrets.');
  return { keyId, authorization: `Basic ${btoa(`${keyId}:${secret}`)}` };
}

export async function refreshProviderSubscription(subscriptionId: string) {
  const { authorization } = razorpayAuth();
  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: authorization },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.description || 'Could not verify subscription status with Razorpay');
  return result;
}

export function subscriptionValues(providerSubscription: Record<string, unknown>, userId?: string) {
  const notes = providerSubscription.notes as Record<string, unknown> | undefined;
  const unixToIso = (value: unknown) => typeof value === 'number' && value > 0 ? new Date(value * 1000).toISOString() : null;
  return {
    ...(userId ? { user_id: userId } : {}),
    provider: 'razorpay',
    provider_subscription_id: String(providerSubscription.id || ''),
    provider_plan_id: String(providerSubscription.plan_id || ''),
    status: String(providerSubscription.status || 'created'),
    current_start: unixToIso(providerSubscription.current_start),
    current_end: unixToIso(providerSubscription.current_end),
    updated_at: new Date().toISOString(),
    ...(notes?.skillora_user_id && !userId ? { user_id: String(notes.skillora_user_id) } : {}),
  };
}
