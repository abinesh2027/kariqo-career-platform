// Skillvo AI roadmap endpoint. GEMINI_API_KEY stays in Supabase Function secrets.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sign in is required' }, 401);

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return json({ error: 'Invalid session' }, 401);

  let input: { goal?: unknown; skills?: unknown };
  try { input = await req.json(); } catch { return json({ error: 'Request body must be valid JSON' }, 400); }
  const { goal, skills = [] } = input;
  if (typeof goal !== 'string' || !goal.trim()) return json({ error: 'Career goal is required' }, 400);
  if (goal.length > 160) return json({ error: 'Career goal must be 160 characters or fewer' }, 400);
  if (!Array.isArray(skills) || skills.length > 80) return json({ error: 'Skills must be a list of up to 80 items' }, 400);
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('skillora_key_1');
  if (!apiKey) return json({ error: 'AI roadmap is not enabled yet. Add a GEMINI_API_KEY secret to enable it.' }, 503);

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'You are Skillvo, a practical learning coach for college students. Return only valid JSON. Use the supplied career goal and current skills. Never claim a skill the student has not listed. Make the plan realistic for a student with about 5 hours per week. Keep all strings concise. If no skills are supplied, say so and include a simple self-assessment step.' }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({
        task: 'Create a personalized skill-gap analysis and actionable six-week roadmap.',
        career_goal: goal.trim(),
        current_skills: skills,
        required_json_shape: {
          summary: '2 short sentences',
          strengths: ['skill the student already listed'],
          gaps: [{ skill: 'skill to learn', priority: 'High | Medium | Low', reason: 'why it matters', first_step: 'one concrete first action' }],
          weeks: [{ week: 1, title: 'focus', activities: ['action'], outcome: 'measurable result' }],
          project_ideas: [{ title: 'small portfolio project', description: 'what to build', skills_used: ['skill'] }],
          next_action: 'one thing to do today'
        }
      }) }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1400 },
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    const providerMessage = String(result.error?.message || '');
    const providerStatus = String(result.error?.status || 'unknown_error');
    // Never return the raw provider message: it may contain sensitive request details.
    const detail = response.status === 401 || response.status === 403
      ? 'Gemini rejected this API key. Create a Gemini API key and set it as GEMINI_API_KEY in Supabase.'
      : response.status === 404
        ? 'The configured Gemini model is unavailable. Check the model ID and API project access.'
        : response.status === 429
        ? 'Gemini API quota or rate limit reached. Check Google AI Studio API usage and limits.'
        : 'Gemini could not process the request. Check the API key, model access, and API limits.';
    console.error('Gemini roadmap request failed', response.status, providerStatus, providerMessage.slice(0, 120));
    return json({ error: `Gemini request failed (${response.status}, ${providerStatus})`, detail }, 502);
  }
  const outputText = result.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === 'string')?.text;
  if (typeof outputText !== 'string') return json({ error: 'AI returned an empty roadmap. Please try again.' }, 502);
  try {
    const roadmap = JSON.parse(outputText);
    if (!roadmap || typeof roadmap.summary !== 'string' || !Array.isArray(roadmap.gaps) || !Array.isArray(roadmap.weeks)) {
      return json({ error: 'AI returned an incomplete roadmap. Please try again.' }, 502);
    }
    return json({ goal: goal.trim(), result: roadmap });
  } catch {
    return json({ error: 'AI returned an unreadable roadmap. Please try again.' }, 502);
  }
});
