import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function getAdmin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getSignedInUser(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToBytes(pem: string) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signMeetingToken(payload: Record<string, unknown>, appId: string, keyId: string, privatePem: string) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privatePem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const header = { alg: 'RS256', kid: appId + '/' + keyId, typ: 'JWT' };
  const encodedHeader = base64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = encodedHeader + '.' + encodedPayload;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return signingInput + '.' + base64Url(new Uint8Array(signature));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
    const user = await getSignedInUser(req);
    if (!user) return json({ error: 'Sign in again to join this class.' }, 401);

    let input: { classId?: unknown };
    try { input = await req.json(); } catch { return json({ error: 'Class details are missing.' }, 400); }
    if (typeof input.classId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.classId)) {
      return json({ error: 'Choose a valid live class.' }, 400);
    }

    const appId = Deno.env.get('JAAS_APP_ID');
    const keyId = Deno.env.get('JAAS_KEY_ID');
    const privateKey = Deno.env.get('JAAS_PRIVATE_KEY');
    if (!appId || !keyId || !privateKey) {
      console.error('JaaS credentials are not configured in Supabase Function Secrets.');
      return json({ error: 'Live classes are still being configured. Try again shortly.' }, 503);
    }

    const admin = getAdmin();
    const { data: liveClass, error: classError } = await admin.from('live_classes')
      .select('id,title,instructor_id,published').eq('id', input.classId).maybeSingle();
    if (classError) {
      console.error('JaaS live class lookup failed', classError.message);
      return json({ error: 'Could not verify this class. Try again.' }, 500);
    }
    if (!liveClass) return json({ error: 'This class could not be found.' }, 404);

    const isMentor = liveClass.instructor_id === user.id;
    if (!isMentor) {
      if (!liveClass.published) return json({ error: 'This class is not available to students.' }, 403);
      const { data: registration, error: registrationError } = await admin.from('class_registrations')
        .select('id').eq('class_id', liveClass.id).eq('user_id', user.id).maybeSingle();
      if (registrationError) {
        console.error('JaaS class registration lookup failed', registrationError.message);
        return json({ error: 'Could not verify your class registration. Try again.' }, 500);
      }
      if (!registration) return json({ error: 'Register for this class before joining.' }, 403);
    }

    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const now = Math.floor(Date.now() / 1000);
    const room = 'Kariqo-' + liveClass.id.replace(/[^a-zA-Z0-9-]/g, '');
    const token = await signMeetingToken({
      aud: 'jitsi',
      iss: 'chat',
      sub: appId,
      room,
      nbf: now - 5,
      iat: now,
      exp: now + 60 * 60,
      context: {
        user: {
          id: user.id,
          name: profile?.full_name || user.user_metadata?.full_name || user.email || 'Kariqo learner',
          email: user.email || '',
          moderator: isMentor ? 'true' : 'false',
        },
        features: {
          livestreaming: false,
          recording: false,
          transcription: false,
          'file-upload': false,
          'list-visitors': false,
        },
        room: { regex: false },
      },
    }, appId, keyId, privateKey);

    return json({ token, roomName: appId + '/' + room, domain: '8x8.vc', externalApiUrl: 'https://8x8.vc/' + appId + '/external_api.js', isModerator: isMentor });
  } catch (error) {
    console.error('JaaS meeting token creation failed', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Could not start this live class. Please try again.' }, 500);
  }
});
