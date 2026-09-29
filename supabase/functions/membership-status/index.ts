import { corsHeaders, getAdmin, getSignedInUser, json, refreshProviderSubscription, subscriptionValues } from '../_shared/membership.ts';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const user = await getSignedInUser(req);
  if (!user) return json({ error: 'Sign in is required' }, 401);
  const admin = getAdmin();
  const { data: current, error } = await admin.from('memberships').select('*').eq('user_id', user.id).maybeSingle();
  if (error) return json({ error: 'Could not load membership status' }, 500);
  if (!current) return json({ active: false, status: 'none' });
  try {
    const latest = await refreshProviderSubscription(current.provider_subscription_id);
    const values = subscriptionValues(latest, user.id);
    const { error: updateError } = await admin.from('memberships').upsert(values);
    if (updateError) throw updateError;
    const end = values.current_end ? new Date(values.current_end).getTime() : 0;
    const active = values.status === 'active' || (values.status === 'cancelled' && end > Date.now());
    return json({ active, status: values.status, currentEnd: values.current_end });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not verify payment status' }, 502);
  }
});
