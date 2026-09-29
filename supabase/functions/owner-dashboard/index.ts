import { corsHeaders, getAdmin, getSignedInUser, json } from '../_shared/membership.ts';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
  const user = await getSignedInUser(req);
  if (!user) return json({ error: 'Sign in is required' }, 401);
  const admin = getAdmin();
  const { data: owner, error: ownerError } = await admin
    .from('skillora_owner_accounts').select('user_id').eq('user_id', user.id).maybeSingle();
  if (ownerError) return json({ error: 'Owner access is not configured. Apply the owner dashboard migration and provision an owner account.' }, 503);
  if (!owner) return json({ error: 'Owner access is required' }, 403);

  let input: { action?: string; requestId?: string; decision?: 'approve' | 'reject' } = {};
  try { input = await req.json(); } catch { /* Empty request bodies are supported for older clients. */ }
  if (input.action === 'review-company-request') {
    if (!input.requestId || !['approve', 'reject'].includes(input.decision || '')) {
      return json({ error: 'Choose a pending company request and approve or reject it.' }, 400);
    }
    const { data, error } = await admin.rpc('review_skillora_company_request', {
      request_id: input.requestId,
      decision: input.decision,
    });
    if (error) return json({ error: `Could not review company request: ${error.message}` }, 500);
    return json({ ok: true, result: data?.[0] || null });
  }

  const [{ data: memberships, error: membershipError }, { data: profiles, error: profileError }] = await Promise.all([
    admin.from('memberships').select('user_id,status,current_start,current_end,updated_at,provider_subscription_id,provider_plan_id').order('updated_at', { ascending: false }),
    admin.from('profiles').select('id,full_name,created_at').order('created_at', { ascending: false }),
  ]);
  if (membershipError || profileError) {
    const detail = membershipError?.message || profileError?.message || 'Unknown database error';
    console.error('owner-dashboard query failed', detail);
    return json({ error: `Could not load management data: ${detail}` }, 500);
  }

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const subscriptions = await Promise.all((memberships || []).map(async (membership) => {
    const { data } = await admin.auth.admin.getUserById(membership.user_id);
    const profile = profileById.get(membership.user_id);
    return {
      userId: membership.user_id,
      name: profile?.full_name || '',
      email: data.user?.email || '',
      status: membership.status,
      currentEnd: membership.current_end,
      updatedAt: membership.updated_at,
      providerSubscriptionId: membership.provider_subscription_id,
    };
  }));

  const { data: rawRequests, error: requestError } = await admin.from('skillora_company_requests')
    .select('id,user_id,company_name,contact_name,status,created_at').order('created_at', { ascending: false });
  if (requestError) {
    const detail = `Could not load company requests: ${requestError.message}`;
    console.error('owner-dashboard request query failed', detail);
    return json({ error: detail }, 500);
  }
  const companyRequests = await Promise.all((rawRequests || []).map(async (request) => {
    const { data } = await admin.auth.admin.getUserById(request.user_id);
    return { id: request.id, userId: request.user_id, companyName: request.company_name,
      contactName: request.contact_name, email: data.user?.email || '', status: request.status, createdAt: request.created_at };
  }));

  const sharedPaymentSecrets = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
  const missing = [...sharedPaymentSecrets, 'RAZORPAY_PLAN_ID'].filter((name) => !Deno.env.get(name));
  const companyMissing = [...sharedPaymentSecrets, 'RAZORPAY_COMPANY_PLAN_ID'].filter((name) => !Deno.env.get(name));
  const activeSubscriptions = subscriptions.filter((item) => item.status === 'active' ||
    (item.status === 'cancelled' && item.currentEnd && new Date(item.currentEnd).getTime() > Date.now())).length;

  return json({
    totalUsers: profiles?.length || 0,
    totalSubscriptions: subscriptions.length,
    activeSubscriptions,
    paymentSetup: { ready: missing.length === 0, missing },
    companyPaymentSetup: { ready: companyMissing.length === 0, missing: companyMissing },
    subscriptions,
    companyRequests,
  });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('owner-dashboard failed', detail);
    return json({ error: `Owner dashboard failed: ${detail}` }, 500);
  }
});
