import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function readinessScore(profile: Record<string, any>, skills: Record<string, any>[], projects: Record<string, any>[], practices: Record<string, any>[], attendance: Record<string, any>[], submissions: Record<string, any>[]) {
  const profilePoints = ['full_name', 'course', 'college', 'career_goal', 'bio'].filter((key) => String(profile[key] || '').trim()).length * 3;
  const skillPoints = Math.min(20, skills.length * 4);
  const completed = projects.filter((project) => Number(project.progress) === 100).length;
  const projectPoints = Math.min(25, completed * 15 + Math.min(10, projects.filter((project) => Number(project.progress) > 0 && Number(project.progress) < 100).length * 2));
  const practiceDays = new Set(practices.map((session) => String(session.practice_date).slice(0, 10)));
  const practicePoints = Math.min(20, practiceDays.size * 5);
  const attendanceRate = attendance.length ? attendance.filter((item) => ['present', 'late'].includes(item.attendance_status)).length / attendance.length : 0;
  const scores = submissions.map((item) => Number(item.score)).filter(Number.isFinite);
  const learningPoints = Math.round(attendanceRate * 8 + (scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length * 0.07 : 0));
  return Math.min(100, profilePoints + skillPoints + projectPoints + practicePoints + learningPoints);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sign in with your approved company account.' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json({ error: 'Company portal is not configured on the server.' }, 503);

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: 'Your sign-in expired. Sign in again.' }, 401);

    const admin = createClient(url, serviceKey);
    let input: { action?: string; title?: string; description?: string; requiredSkills?: string[]; location?: string; jobType?: string; jobId?: string; studentId?: string; companyName?: string; offerId?: string; status?: string; applicationId?: string };
    try { input = await req.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const action = input.action || 'load';
    if (action === 'request-access') {
      const companyName = String(input.companyName || '').trim();
      if (companyName.length < 2 || companyName.length > 120) {
        return json({ error: 'Enter a company name between 2 and 120 characters.' }, 400);
      }
      const { data: existing, error: existingError } = await admin.from('skillora_company_requests')
        .select('id,status').eq('user_id', user.id).maybeSingle();
      if (existingError) return json({ error: `Could not check company request: ${existingError.message}` }, 500);
      if (existing?.status === 'approved') return json({ error: 'This account is already approved. Sign in again to open the company workspace.' }, 409);
      const { error: requestError } = await admin.from('skillora_company_requests').upsert({
        user_id: user.id,
        company_name: companyName,
        contact_name: String(user.user_metadata?.full_name || '').trim().slice(0, 120),
        status: 'pending',
        reviewed_at: null,
      }, { onConflict: 'user_id' });
      if (requestError) return json({ error: `Could not submit company access request: ${requestError.message}` }, 500);
      return json({ accessStatus: 'pending', requestedCompany: companyName });
    }
    if (action === 'list-jobs') {
      const { data: approvedAccounts, error: approvedError } = await admin.from('skillora_company_accounts').select('company_id').eq('approved', true);
      if (approvedError) return json({ error: `Could not load approved employers: ${approvedError.message}` }, 500);
      const companyIds = [...new Set((approvedAccounts || []).map((account) => account.company_id))];
      if (!companyIds.length) return json({ jobs: [] });
      const [{ data: jobs, error: jobsError }, { data: companies, error: companiesError }] = await Promise.all([
        admin.from('skillora_company_jobs').select('id,company_id,title,description,required_skills,location,job_type,created_at').eq('status', 'open').in('company_id', companyIds).order('created_at', { ascending: false }),
        admin.from('skillora_companies').select('id,name').in('id', companyIds),
      ]);
      if (jobsError || companiesError) return json({ error: `Could not load company jobs: ${jobsError?.message || companiesError?.message}` }, 500);
      const names = new Map((companies || []).map((company) => [company.id, company.name]));
      return json({ jobs: (jobs || []).map((job) => ({ ...job, company_name: names.get(job.company_id) || 'Approved company' })) });
    }
    if (action === 'apply-job') {
      const jobId = String(input.jobId || '');
      if (!jobId) return json({ error: 'Choose a job to apply for.' }, 400);
      const { data: approvedAccounts, error: approvedError } = await admin.from('skillora_company_accounts').select('company_id').eq('approved', true);
      if (approvedError) return json({ error: `Could not verify the employer: ${approvedError.message}` }, 500);
      const companyIds = (approvedAccounts || []).map((account) => account.company_id);
      const { data: job, error: jobError } = await admin.from('skillora_company_jobs').select('id,company_id,title,location,status').eq('id', jobId).single();
      if (jobError || !job || job.status !== 'open' || !companyIds.includes(job.company_id)) return json({ error: 'This job is no longer accepting applications.' }, 404);
      const { data: company } = await admin.from('skillora_companies').select('name').eq('id', job.company_id).single();
      const { error } = await admin.from('skillvo_job_applications').upsert({
        student_id: user.id, company_job_id: job.id, source_key: `company-job:${job.id}`,
        job_title: job.title, company_name: company?.name || 'Approved company', status: 'applied',
      }, { onConflict: 'student_id,source_key', ignoreDuplicates: true });
      if (error) return json({ error: `Could not submit your application: ${error.message}` }, 500);
      return json({ ok: true, message: 'Application sent to the company.' });
    }
    if (action === 'respond-offer') {
      const offerId = String(input.offerId || '');
      const status = String(input.status || '');
      if (!offerId || !['accepted', 'declined'].includes(status)) return json({ error: 'Choose accept or decline for this offer.' }, 400);
      const { data: offer, error: offerError } = await admin.from('skillora_job_offers').select('id,job_id,job_title,job_location,company_name').eq('id', offerId).eq('student_id', user.id).eq('status', 'sent').single();
      if (offerError || !offer) return json({ error: 'This offer is no longer waiting for a response.' }, 404);
      const { error: updateError } = await admin.from('skillora_job_offers').update({ status }).eq('id', offer.id).eq('student_id', user.id);
      if (updateError) return json({ error: `Could not update your offer: ${updateError.message}` }, 500);
      const { error: appError } = await admin.from('skillvo_job_applications').upsert({
        student_id: user.id, company_job_id: offer.job_id, source_key: `offer:${offer.id}`,
        job_title: offer.job_title || 'Company role', company_name: offer.company_name || '', status: status === 'accepted' ? 'offer' : 'rejected',
      }, { onConflict: 'student_id,source_key' });
      if (appError) return json({ error: `Offer response saved, but the application tracker could not update: ${appError.message}` }, 500);
      return json({ ok: true, message: status === 'accepted' ? 'Offer accepted and added to your tracker.' : 'Offer declined.' });
    }
    const { data: access, error: accessError } = await admin
      .from('skillora_company_accounts').select('company_id,approved').eq('user_id', user.id).maybeSingle();
    if (accessError) return json({ error: `Could not verify company access: ${accessError.message}` }, 500);
    if (!access?.approved) {
      const { data: request, error: requestError } = await admin.from('skillora_company_requests')
        .select('company_name,status,created_at').eq('user_id', user.id).maybeSingle();
      if (requestError) return json({ error: `Could not check company registration: ${requestError.message}` }, 500);
      if (action === 'load' && request) return json({ accessStatus: request.status, requestedCompany: request.company_name, requestedAt: request.created_at });
      if (action === 'load') return json({ accessStatus: 'not_requested' });
      return json({ error: 'Company access is not approved yet. Contact Skillvo management.' }, 403);
    }

    const { data: company, error: companyError } = await admin
      .from('skillora_companies').select('id,name').eq('id', access.company_id).single();
    if (companyError || !company) return json({ error: `Company profile is unavailable${companyError ? `: ${companyError.message}` : '.'}` }, 500);

    const { data: companySubscription, error: subscriptionError } = await admin
      .from('skillora_company_subscriptions').select('provider_subscription_id,status,current_end')
      .eq('company_id', company.id).maybeSingle();
    if (subscriptionError) return json({ error: `Could not check company billing: ${subscriptionError.message}` }, 500);
    const subscriptionStillValid = companySubscription?.status === 'active' ||
      (companySubscription?.status === 'cancelled' && companySubscription.current_end && new Date(companySubscription.current_end).getTime() > Date.now());

    if (action === 'update-application') {
      const applicationId = String(input.applicationId || '');
      const status = String(input.status || '');
      if (!applicationId || !['screening', 'interview', 'rejected'].includes(status)) return json({ error: 'Choose a valid application stage.' }, 400);
      const { data: application, error: applicationError } = await admin.from('skillvo_job_applications').select('id,company_job_id').eq('id', applicationId).single();
      if (applicationError || !application?.company_job_id) return json({ error: 'Application not found.' }, 404);
      const { data: job } = await admin.from('skillora_company_jobs').select('id').eq('id', application.company_job_id).eq('company_id', company.id).single();
      if (!job) return json({ error: 'This application belongs to another company.' }, 403);
      const { error } = await admin.from('skillvo_job_applications').update({ status, updated_at: new Date().toISOString() }).eq('id', application.id);
      if (error) return json({ error: `Could not update application: ${error.message}` }, 500);
      return json({ ok: true });
    }

    if (action === 'create-subscription') {
      const planId = Deno.env.get('RAZORPAY_COMPANY_PLAN_ID');
      const keyId = Deno.env.get('RAZORPAY_KEY_ID');
      const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
      if (!planId || !keyId || !keySecret) return json({ error: 'Company checkout is not configured. Add Razorpay keys and the ₹2,499 monthly company plan in Supabase Function Secrets.' }, 503);
      if (subscriptionStillValid) return json({ active: true });
      const authorizationHeader = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
      const planResponse = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`, { headers: { Authorization: authorizationHeader } });
      const plan = await planResponse.json();
      if (!planResponse.ok) return json({ error: plan.error?.description || 'Could not verify the company plan in Razorpay.' }, 502);
      if (plan.period !== 'monthly' || plan.interval !== 1 || plan.item?.amount !== 249900 || plan.item?.currency !== 'INR') {
        return json({ error: 'Razorpay company plan must be ₹2,499 INR billed monthly.' }, 409);
      }
      const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
        method: 'POST', headers: { Authorization: authorizationHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, total_count: 100, quantity: 1, customer_notify: true,
          notes: { skillora_company_id: company.id, skillora_user_id: user.id, product: 'company-pro-hiring' } }),
      });
      const subscription = await response.json();
      if (!response.ok) return json({ error: subscription.error?.description || 'Razorpay could not start company checkout.' }, 502);
      if (!subscription.short_url) return json({ error: 'Razorpay did not return a secure checkout link.' }, 502);
      const { error: saveError } = await admin.from('skillora_company_subscriptions').upsert({
        company_id: company.id, provider: 'razorpay', provider_subscription_id: subscription.id,
        provider_plan_id: planId, status: subscription.status || 'created', updated_at: new Date().toISOString(),
      });
      if (saveError) {
        await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscription.id)}/cancel`, {
          method: 'POST', headers: { Authorization: authorizationHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancel_at_cycle_end: false }),
        });
        return json({ error: 'Company subscription could not be saved securely. Please try again.' }, 500);
      }
      return json({ active: false, checkoutUrl: subscription.short_url });
    }

    if (action === 'create-job') {
      const title = String(input.title || '').trim();
      const description = String(input.description || '').trim();
      const requiredSkills = [...new Set((input.requiredSkills || []).map((skill) => String(skill).trim()).filter(Boolean))].slice(0, 20);
      if (title.length < 3 || title.length > 120) return json({ error: 'Add a job title between 3 and 120 characters.' }, 400);
      if (!requiredSkills.length) return json({ error: 'Add at least one required skill so Skillvo can find relevant students.' }, 400);
      const { count: activeJobCount, error: countError } = await admin.from('skillora_company_jobs')
        .select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'open');
      if (countError) return json({ error: `Could not check your active job limit: ${countError.message}` }, 500);
      const jobLimit = subscriptionStillValid ? 5 : 1;
      if ((activeJobCount || 0) >= jobLimit) return json({ error: subscriptionStillValid
        ? 'Your plan allows up to 5 active jobs. Close a job before posting another.'
        : 'Starter includes 1 active job. Upgrade to Pro for up to 5 active jobs.', upgradeRequired: !subscriptionStillValid }, 403);
      const { data: job, error } = await admin.from('skillora_company_jobs').insert({
        company_id: company.id, created_by: user.id, title, description: description.slice(0, 4000),
        required_skills: requiredSkills, location: String(input.location || '').trim().slice(0, 160),
        job_type: String(input.jobType || 'Full-time').trim().slice(0, 40), status: 'open',
      }).select('id').single();
      if (error) return json({ error: `Could not publish this job: ${error.message}` }, 500);
      return json({ ok: true, jobId: job.id });
    }

    if (action === 'send-offer') {
      if (!input.jobId || !input.studentId) return json({ error: 'Choose a job and a matched student.' }, 400);
      const [{ data: job, error: jobError }, { data: student, error: studentError }] = await Promise.all([
        admin.from('skillora_company_jobs').select('id,company_id,title,required_skills,status').eq('id', input.jobId).eq('company_id', company.id).single(),
        admin.from('profiles').select('id,full_name,course,college,career_goal,bio,learning_complete,interview_ready,recruiter_visible,ats_resume_text').eq('id', input.studentId).single(),
      ]);
      if (jobError || !job || job.status !== 'open') return json({ error: 'This job is not available for offers.' }, 404);
      if (studentError || !student || !student.learning_complete || !student.interview_ready || !student.recruiter_visible || !student.ats_resume_text) {
        return json({ error: 'This student is no longer sharing an unlocked ATS resume.' }, 409);
      }
      const [{ data: skillRows }, { data: studentProjects }, { count: roadmapCount }, { data: practices }, { data: attendance }, { data: submissions }] = await Promise.all([
        admin.from('skills').select('name,score').eq('user_id', student.id),
        admin.from('projects').select('id,progress').eq('user_id', student.id),
        admin.from('roadmaps').select('id', { count: 'exact', head: true }).eq('user_id', student.id),
        admin.from('skillvo_interview_practice').select('practice_date').eq('user_id', student.id),
        admin.from('class_registrations').select('attendance_status').eq('user_id', student.id),
        admin.from('mentor_assignment_submissions').select('score').eq('student_id', student.id).not('score', 'is', null),
      ]);
      if (!studentProjects?.some((project) => Number(project.progress) === 100) || !roadmapCount) return json({ error: 'This student no longer meets the interview-ready requirements.' }, 409);
      const currentScore = readinessScore(student, skillRows || [], studentProjects || [], practices || [], attendance || [], submissions || []);
      if (currentScore < 70) return json({ error: 'This student no longer meets the 70-point career readiness threshold.' }, 409);
      const studentSkills = new Set((skillRows || []).map((row) => String(row.name).toLowerCase()));
      const requiredSkills = (job.required_skills || []).map((skill: string) => String(skill).toLowerCase());
      const score = Math.round(requiredSkills.filter((skill: string) => studentSkills.has(skill)).length / requiredSkills.length * 100);
      if (score < 50) return json({ error: 'This student no longer meets the job skill match threshold.' }, 409);

      const { error } = await admin.from('skillora_job_offers').upsert({
        company_id: company.id, job_id: job.id, student_id: student.id, match_score: score, status: 'sent',
        company_name: company.name, job_title: job.title, job_location: job.location,
      }, { onConflict: 'job_id,student_id' });
      if (error) return json({ error: `Could not send the offer: ${error.message}` }, 500);
      return json({ ok: true, message: 'Job offer sent to the student's Skillvo workspace.' });
    }

    if (action !== 'load') return json({ error: 'Unknown company portal action.' }, 400);
    const [{ data: jobs, error: jobsError }, { data: offers, error: offersError }] = await Promise.all([
      admin.from('skillora_company_jobs').select('id,title,description,required_skills,location,job_type,status,created_at').eq('company_id', company.id).order('created_at', { ascending: false }),
      admin.from('skillora_job_offers').select('id,job_id,student_id,match_score,status,created_at,company_name,job_title,job_location').eq('company_id', company.id).order('created_at', { ascending: false }),
    ]);
    if (jobsError || offersError) return json({ error: `Could not load company workspace: ${jobsError?.message || offersError?.message}` }, 500);
    const companyJobIds = (jobs || []).map((job) => job.id);
    let companyApplications: Record<string, unknown>[] = [];
    if (companyJobIds.length) {
      const { data: applications, error: applicationsError } = await admin.from('skillvo_job_applications')
        .select('id,company_job_id,student_id,job_title,status,created_at').in('company_job_id', companyJobIds)
        .order('created_at', { ascending: false });
      if (applicationsError) return json({ error: `Could not load job applicants: ${applicationsError.message}` }, 500);
      const applicantIds = [...new Set((applications || []).map((application) => application.student_id))];
      const { data: applicantProfiles } = applicantIds.length
        ? await admin.from('profiles').select('id,full_name,course,college').in('id', applicantIds)
        : { data: [] as any[] };
      const applicantMap = new Map((applicantProfiles || []).map((profile) => [profile.id, profile]));
      companyApplications = (applications || []).map((application) => ({
        ...application, student: applicantMap.get(application.student_id) || { full_name: 'Student' },
      }));
    }

    let candidates: Record<string, unknown>[] = [];
    if (input.jobId && jobs?.some((job) => job.id === input.jobId && job.status === 'open')) {
      const job = jobs.find((item) => item.id === input.jobId)!;
      const { data: profiles, error: profilesError } = await admin.from('profiles')
        .select('id,full_name,course,college,career_goal,bio,learning_complete,interview_ready,recruiter_visible,ats_resume_text')
        .eq('learning_complete', true).eq('interview_ready', true).eq('recruiter_visible', true)
        .neq('ats_resume_text', '').order('updated_at', { ascending: false }).limit(500);
      if (profilesError) return json({ error: `Could not load opted-in candidates: ${profilesError.message}` }, 500);
      const ids = (profiles || []).map((profile) => profile.id);
      if (ids.length) {
        const [{ data: skills, error: skillsError }, { data: projects, error: projectsError }, { data: roadmaps, error: roadmapsError }, { data: practices, error: practicesError }, { data: attendance, error: attendanceError }, { data: submissions, error: submissionsError }] = await Promise.all([
          admin.from('skills').select('user_id,name,score').in('user_id', ids),
          admin.from('projects').select('user_id,title,description,progress').in('user_id', ids),
          admin.from('roadmaps').select('user_id').in('user_id', ids),
          admin.from('skillvo_interview_practice').select('user_id,practice_date').in('user_id', ids),
          admin.from('class_registrations').select('user_id,attendance_status').in('user_id', ids),
          admin.from('mentor_assignment_submissions').select('student_id,score').in('student_id', ids).not('score', 'is', null),
        ]);
        if (skillsError || projectsError || roadmapsError || practicesError || attendanceError || submissionsError) return json({ error: `Could not calculate candidate matches: ${skillsError?.message || projectsError?.message || roadmapsError?.message || practicesError?.message || attendanceError?.message || submissionsError?.message}` }, 500);
        const skillMap = new Map<string, { name: string; score: number }[]>();
        for (const skill of skills || []) skillMap.set(skill.user_id, [...(skillMap.get(skill.user_id) || []), { name: skill.name, score: skill.score }]);
        const projectMap = new Map<string, { title: string; description: string }[]>();
        for (const project of projects || []) if (Number(project.progress) === 100) projectMap.set(project.user_id, [...(projectMap.get(project.user_id) || []), { title: project.title, description: project.description }]);
        const forStudent = (rows: Record<string, any>[], key: string, id: string) => rows.filter((row) => row[key] === id);
        const roadmapIds = new Set((roadmaps || []).map((item) => item.user_id));
        const needed = (job.required_skills || []).map((skill: string) => String(skill).trim().toLowerCase()).filter(Boolean);
        candidates = (profiles || []).filter((profile) => roadmapIds.has(profile.id) && (projectMap.get(profile.id)?.length || 0) > 0)
          .map((profile) => {
            const studentSkills = skillMap.get(profile.id) || [];
            const names = new Set(studentSkills.map((skill) => skill.name.toLowerCase()));
            const matchScore = needed.length ? Math.round(needed.filter((skill: string) => names.has(skill)).length / needed.length * 100) : 0;
            return {
              id: profile.id, name: profile.full_name, course: profile.course, college: profile.college,
              careerGoal: profile.career_goal, bio: profile.bio, resume: profile.ats_resume_text,
              readinessScore: readinessScore(profile, studentSkills, projects?.filter((item) => item.user_id === profile.id) || [], forStudent(practices || [], 'user_id', profile.id), forStudent(attendance || [], 'user_id', profile.id), forStudent(submissions || [], 'student_id', profile.id)),
              skills: studentSkills, projects: projectMap.get(profile.id) || [], matchScore,
              existingOffer: offers?.find((offer) => offer.job_id === job.id && offer.student_id === profile.id) || null,
            };
          }).filter((candidate) => Number(candidate.matchScore) >= 50 && Number(candidate.readinessScore) >= 70)
          .sort((left, right) => Number(right.matchScore) - Number(left.matchScore));
      }
    }
    return json({ company, jobs: jobs || [], offers: offers || [], applications: companyApplications.filter((application) => !input.jobId || application.company_job_id === input.jobId), candidates,
      plan: { name: subscriptionStillValid ? 'Pro hiring' : 'Starter', status: companySubscription?.status || 'free', currentEnd: companySubscription?.current_end || null, activeJobLimit: subscriptionStillValid ? 5 : 1 } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('company-dashboard failed', message);
    return json({ error: `Company portal could not complete this request: ${message}` }, 500);
  }
});
