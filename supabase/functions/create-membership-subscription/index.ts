import { corsHeaders, getAdmin, getSignedInUser, json, razorpayAuth } from '../_shared/membership.ts';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const user = await getSignedInUser(req);
  if (!user) return json({ error: 'Sign in is required' }, 401);

  const planId = Deno.env.get('RAZORPAY_PLAN_ID');
  if (!planId) return json({ error: 'Subscription checkout is not set up yet. The Brain Strom team needs to connect the ₹199 monthly plan.' }, 503);

  try {
    const { keyId, authorization } = razorpayAuth();
    const planResponse = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`, {
      headers: { Authorization: authorization },
    });
    const plan = await planResponse.json();
    if (!planResponse.ok) return json({ error: plan.error?.description || 'Could not verify the subscription plan' }, 502);
    if (plan.period !== 'monthly' || plan.interval !== 1 || plan.item?.amount !== 19900 || plan.item?.currency !== 'INR') {
      return json({ error: 'The connected Razorpay plan must be ₹199 INR billed monthly.' }, 409);
    }

    const admin = getAdmin();
    const { data: previous } = await admin.from('memberships').select('provider_subscription_id,status,current_end')
      .eq('user_id', user.id).maybeSingle();
    if (previous && ['created', 'authenticated', 'active', 'pending', 'halted', 'paused', 'cancelled'].includes(previous.status)) {
      const currentEnd = previous.current_end ? new Date(previous.current_end).getTime() : 0;
      if (previous.status === 'active' || (previous.status === 'cancelled' && currentEnd > Date.now())) {
        return json({ active: true });
      }
      if (previous.status !== 'cancelled') {
        const fetchPending = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(previous.provider_subscription_id)}`, {
          headers: { Authorization: authorization },
        });
        const pending = await fetchPending.json();
        if (fetchPending.ok && pending.short_url) return json({ active: false, checkoutUrl: pending.short_url });
      }
    }

    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        total_count: 100,
        quantity: 1,
        customer_notify: false,
        notes: { skillora_user_id: user.id, product: 'mentor-live-class-access' },
      }),
    });
    const subscription = await response.json();
    if (!response.ok) return json({ error: subscription.error?.description || 'Razorpay could not create the subscription' }, 502);
    const { error } = await admin.from('memberships').upsert({
      user_id: user.id,
      provider: 'razorpay',
      provider_subscription_id: subscription.id,
      provider_plan_id: planId,
      status: subscription.status || 'created',
      updated_at: new Date().toISOString(),
    });
    if (error) {
      await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscription.id)}/cancel`, {
        method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_cycle_end: false }),
      });
      return json({ error: 'Subscription could not be saved securely. Please try again.' }, 500);
    }
    if (!subscription.short_url) return json({ error: 'Razorpay did not return a secure checkout link.' }, 502);
    return json({ active: false, checkoutUrl: subscription.short_url, keyId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Subscription service is unavailable' }, 503);
  }
});
