import { getAdmin, json, refreshProviderSubscription, subscriptionValues } from '../_shared/membership.ts';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const trackedEvents = new Set([
  'subscription.authenticated', 'subscription.activated', 'subscription.charged',
  'subscription.halted', 'subscription.paused', 'subscription.resumed',
  'subscription.cancelled', 'subscription.completed',
]);

async function signatureFor(body: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  const received = req.headers.get('x-razorpay-signature');
  if (!secret || !received) return json({ error: 'Webhook signature is required' }, 401);
  const body = await req.text();
  if (!constantTimeEqual(await signatureFor(body, secret), received.toLowerCase())) return json({ error: 'Invalid webhook signature' }, 401);

  let event: Record<string, unknown>;
  try { event = JSON.parse(body); } catch { return json({ error: 'Invalid webhook payload' }, 400); }
  if (!trackedEvents.has(String(event.event))) return json({ received: true });
  const payload = event.payload as Record<string, { entity?: Record<string, unknown> }> | undefined;
  const subscriptionId = String(payload?.subscription?.entity?.id || '');
  if (!subscriptionId) return json({ received: true });

  try {
    const latest = await refreshProviderSubscription(subscriptionId);
    const notes = latest.notes as Record<string, unknown> | undefined;
    const companyId = String(notes?.skillora_company_id || '');
    if (companyId && notes?.product === 'company-pro-hiring') {
      const unixToIso = (value: unknown) => typeof value === 'number' && value > 0 ? new Date(value * 1000).toISOString() : null;
      const { error } = await getAdmin().from('skillora_company_subscriptions').upsert({
        company_id: companyId,
        provider: 'razorpay',
        provider_subscription_id: String(latest.id || subscriptionId),
        provider_plan_id: String(latest.plan_id || ''),
        status: String(latest.status || 'created'),
        current_start: unixToIso(latest.current_start),
        current_end: unixToIso(latest.current_end),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ received: true });
    }
    const userId = String(notes?.skillora_user_id || '');
    if (!userId) return json({ error: 'Subscription has no Skillvo account reference' }, 422);
    const { error } = await getAdmin().from('memberships').upsert(subscriptionValues(latest, userId));
    if (error) throw error;
    return json({ received: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not update membership' }, 500);
  }
});
