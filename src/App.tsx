import { useEffect, useRef, useState } from 'react';
import type { ReactNode, ChangeEvent, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Code2,
  Building2,
  FileText,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
  CreditCard,
  RefreshCw,
  Flame,
  Trophy,
  MessageSquareText,
  Video,
  ImagePlus,
} from 'lucide-react';
import { backendReady, supabase } from './lib/supabase';
import { storage } from './lib/storage';
import { requestAiRoadmap } from './lib/aiRoadmap';
import './recruiter.css';

type JitsiExternalApi = {
  dispose: () => void;
  addListener: (event: string, listener: (event?: unknown) => void) => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiExternalApi;
  }
}

type Page =
  | 'Overview'
  | 'Skill DNA'
  | 'AI Roadmap'
  | 'Career Copilot'
  | 'Interview Practice'
  | 'Projects'
  | 'Skill Passport'
  | 'Opportunities'
  | 'Job Offers'
  | 'Applications'
  | 'Mentor'
  | 'Live Classes'
  | 'Notifications'
  | 'Announcements'
  | 'Customer Care'
  | 'Profile & Settings';

const links: { name: Page; icon: typeof LayoutDashboard; group: string }[] = [
  ['Overview', LayoutDashboard, 'Workspace'],
  ['Skill DNA', Activity, 'Workspace'],
  ['AI Roadmap', Target, 'Workspace'],
  ['Career Copilot', Sparkles, 'Workspace'],
  ['Interview Practice', MessageSquareText, 'Workspace'],
  ['Projects', Code2, 'Workspace'],
  ['Skill Passport', ShieldCheck, 'Workspace'],
  ['Opportunities', BriefcaseBusiness, 'Discover'],
  ['Job Offers', Send, 'Discover'],
  ['Applications', BriefcaseBusiness, 'Discover'],
  ['Mentor', Users, 'Discover'],
  ['Live Classes', CalendarDays, 'Discover'],
  ['Notifications', Bell, 'Updates'],
  ['Announcements', MessageCircle, 'Updates'],
  ['Customer Care', CircleHelp, 'Support'],
  ['Profile & Settings', Settings, 'Account'],
].map(([name, icon, group]) => ({
  name: name as Page,
  icon: icon as typeof LayoutDashboard,
  group: group as string,
}));

type Notice = { id?: string; title: string; detail: string; time: string; unread: boolean };
type Records = {
  profile: Record<string, any>;
  preferences: Record<string, any>;
  skills: Record<string, any>[];
  projects: Record<string, any>[];
  roadmaps: Record<string, any>[];
  opportunities: Record<string, any>[];
  mentors: Record<string, any>[];
  classes: Record<string, any>[];
  announcements: Record<string, any>[];
  jobOffers: Record<string, any>[];
  interviewSessions: Record<string, any>[];
  attendance: Record<string, any>[];
  assignmentScores: Record<string, any>[];
  applications: Record<string, any>[];
};

const emptyRecords: Records = {
  profile: {},
  preferences: {},
  skills: [],
  projects: [],
  roadmaps: [],
  opportunities: [],
  mentors: [],
  classes: [],
  announcements: [],
  jobOffers: [],
  interviewSessions: [],
  attendance: [],
  assignmentScores: [],
  applications: [],
};

type ToastState = { msg: string; type: 'success' | 'error' | 'info' };

async function addMaterialAccessUrls(items: Record<string, any>[]) {
  const client = supabase;
  if (!client) return items;
  return Promise.all(items.map(async (item) => {
    if (!item.storage_path) return { ...item, access_url: item.url };
    const { data, error } = await client.storage.from('mentor-class-materials').createSignedUrl(item.storage_path, 3600);
    return { ...item, access_url: error ? '' : data.signedUrl };
  }));
}

export default function App() {
  const [page, setPage] = useState<Page>('Overview');
  const [user, setUser] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [goal, setGoal] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [userId, setUserId] = useState('');
  const [accountType, setAccountType] = useState<'student' | 'mentor' | 'owner' | 'company'>('student');
  const [loginPortal, setLoginPortal] = useState<'student' | 'mentor' | 'owner' | 'company'>(() => {
    const portal = new URLSearchParams(window.location.search).get('portal');
    return portal === 'mentor' || portal === 'owner' || portal === 'company' ? portal : 'student';
  });
  const [membership, setMembership] = useState<{ status: string; current_end: string | null } | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [auth, setAuth] = useState(true);
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const say = (s: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg: s, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Synchronize authentication reactively
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    // Initial check
    client.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setAuth(true);
        return;
      }
      if (loginPortal !== 'owner' && loginPortal !== 'company') setAuth(false);
      if (data.session) {
        setEmail(data.session.user.email || '');
        setUser(data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || 'Student');
        setUserId(data.session.user.id);
        if (loginPortal === 'owner') {
          const { data: owner } = await client.from('skillora_owner_accounts').select('user_id').eq('user_id', data.session.user.id).maybeSingle();
          if (owner) {
            setAccountType('owner');
            setAuth(false);
          }
          else {
            setAuth(true);
            await client.auth.signOut();
            say('This account is not enabled for owner management.', 'error');
          }
        } else if (loginPortal === 'company') {
          const { data: companyData, error: companyError } = await client.functions.invoke('company-dashboard', { body: { action: 'load' } });
          if (companyData && !companyError) {
            setAccountType('company');
            setAuth(false);
          } else {
            setAuth(true);
            await client.auth.signOut();
            say(companyError ? 'Company access could not be checked. Contact Kariqo management.' : 'This account is not approved for the company portal.', 'error');
          }
        } else setAccountType(data.session.user.user_metadata?.account_type === 'mentor' ? 'mentor' : 'student');
      }
    });

    // Reactive subscription to auth state changes (login, logout, token refresh, confirmation)
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) setAuth(true);
      else if (loginPortal !== 'owner' && loginPortal !== 'company') setAuth(false);
      if (session) {
        setEmail(session.user.email || '');
        setUser(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Student');
        setUserId(session.user.id);
        if (loginPortal !== 'owner' && loginPortal !== 'company') setAccountType(session.user.user_metadata?.account_type === 'mentor' ? 'mentor' : 'student');
      } else {
        setUser('');
        setEmail('');
        setUserId('');
        setAccountType('student');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loginPortal]);

  // Fetch student workspace records when logged in
  useEffect(() => {
    if (!supabase || auth) return;
    let active = true;

    (async () => {
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      if (!current || !active) {
        if (active) setMembershipLoading(false);
        return;
      }
      setUserId(current.id);

      const [
        profile,
        preferences,
        skillsResult,
        projectsResult,
        roadmapsResult,
        noticesResult,
        oppsResult,
        mentorsResult,
        classesResult,
        announcementsResult,
        membershipResult,
        jobOffersResult,
        interviewSessionsResult,
        attendanceResult,
        assignmentScoresResult,
        applicationsResult,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', current.id).maybeSingle(),
        supabase.from('preferences').select('*').eq('user_id', current.id).maybeSingle(),
        supabase.from('skills').select('*').eq('user_id', current.id).order('name'),
        supabase.from('projects').select('*').eq('user_id', current.id).order('created_at', { ascending: false }),
        supabase.from('roadmaps').select('*').eq('user_id', current.id).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('user_id', current.id).order('created_at', { ascending: false }),
        supabase.from('opportunities').select('*').eq('published', true).order('created_at', { ascending: false }),
        supabase.from('mentors').select('*').eq('published', true).order('full_name'),
        supabase.from('live_classes').select('*').eq('published', true).order('starts_at'),
        supabase.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }),
        supabase.from('memberships').select('status,current_end').eq('user_id', current.id).maybeSingle(),
        supabase.from('skillora_job_offers').select('id,status,match_score,created_at,company_name,job_title,job_location').eq('student_id', current.id).order('created_at', { ascending: false }),
        supabase.from('skillvo_interview_practice').select('*').eq('user_id', current.id).order('practice_date', { ascending: false }),
        supabase.from('class_registrations').select('class_id,attendance_status,attended_at').eq('user_id', current.id),
        supabase.from('mentor_assignment_submissions').select('score,reviewed_at').eq('student_id', current.id).not('score', 'is', null).order('reviewed_at', { ascending: false, nullsFirst: false }),
        supabase.from('skillvo_job_applications').select('*').eq('student_id', current.id).order('updated_at', { ascending: false }),
      ]);

      if (!active) return;
      setMembership(membershipResult.data || null);
      setMembershipLoading(false);
      setRecords({
        profile: profile.data || {},
        preferences: preferences.data || {},
        skills: skillsResult.data || [],
        projects: projectsResult.data || [],
        roadmaps: roadmapsResult.data || [],
        opportunities: oppsResult.data || [],
        mentors: mentorsResult.data || [],
        classes: classesResult.data || [],
        announcements: announcementsResult.data || [],
        jobOffers: jobOffersResult.data || [],
        interviewSessions: interviewSessionsResult.data || [],
        attendance: attendanceResult.data || [],
        assignmentScores: assignmentScoresResult.data || [],
        applications: applicationsResult.data || [],
      });

      const p = profile.data;
      if (p) {
        setUser(p.full_name || current.user_metadata?.full_name || current.email?.split('@')[0] || 'Student');
        setGoal(p.career_goal || '');
        if (p.avatar_path) {
          const { data } = await supabase.storage.from('avatars').createSignedUrl(p.avatar_path, 3600);
          if (active && data?.signedUrl) setPhoto(data.signedUrl);
        }
      }

      setNotices(
        (noticesResult.data || []).map(
          (n) =>
            ({
              id: n.id,
              title: n.title,
              detail: n.body,
              time: new Date(n.created_at).toLocaleString(),
              unread: !n.read_at,
            }) as Notice,
        ),
      );
    })();

    return () => {
      active = false;
    };
  }, [auth]);

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
      say('Backend is not configured for this app', 'error');
      return 'Backend is not configured for this app';
    }
    const f = new FormData(e.currentTarget);
    const mail = String(f.get('email')).trim();
    const pass = String(f.get('password'));

    const { data, error } = await supabase.auth.signInWithPassword({
      email: mail,
      password: pass,
    });

    if (error) {
      const msg = error.message.toLowerCase().includes('email not confirmed')
        ? 'Please check your email inbox and click the verification link before signing in.'
        : error.message;
      say(msg, 'error');
      return msg;
    }

    let signedInType: 'student' | 'mentor' | 'owner' | 'company' = data.user.user_metadata?.account_type === 'mentor' ? 'mentor' : 'student';
    if (loginPortal === 'owner') {
      const { data: owner, error: ownerError } = await supabase.from('skillora_owner_accounts').select('user_id').eq('user_id', data.user.id).maybeSingle();
      if (ownerError || !owner) {
        await supabase.auth.signOut();
        return ownerError ? 'Owner access is not configured yet. Contact the Kariqo project owner.' : 'This account is not enabled for owner management.';
      }
      signedInType = 'owner';
    }
    if (loginPortal === 'company') {
      const { data: companyData, error: companyError } = await supabase.functions.invoke('company-dashboard', { body: { action: 'load' } });
      if (companyError || !companyData) {
        await supabase.auth.signOut();
        return companyError ? await functionErrorMessage(companyError, 'Company access could not be checked. Contact the Kariqo owner.') : 'This account is not approved for the company portal yet.';
      }
      signedInType = 'company';
    }
    if (loginPortal === 'mentor' && signedInType !== 'mentor') {
      await supabase.auth.signOut();
      return 'This is a student account. Create a mentor account or switch to Student sign in.';
    }

    setEmail(data.user.email || mail);
    setUser(data.user.user_metadata?.full_name || mail.split('@')[0]);
    setUserId(data.user.id);
    setAccountType(signedInType);
    setAuth(false);
    say('Welcome back!', 'success');
    return '';
  };

  const register = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return 'Backend is not configured.';
    if (loginPortal === 'owner') return 'Owner accounts are provisioned by the project owner. Sign in with your approved owner email.';
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim();
    const mail = String(f.get('email')).trim();
    const pass = String(f.get('password'));
    const companyName = String(f.get('company_name') || '').trim();

    if (loginPortal === 'company' && companyName.length < 2) return 'Enter your company name to request recruiter access.';

    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password: pass,
      options: { data: { full_name: name, account_type: loginPortal, ...(loginPortal === 'company' ? { company_name: companyName } : {}) } },
    });

    if (error) return error.message;
    if (data.session) {
      setEmail(data.user?.email || mail);
      setUser(name);
      setUserId(data.user?.id || '');
      setAccountType(loginPortal === 'mentor' ? 'mentor' : loginPortal === 'company' ? 'company' : 'student');
      setAuth(false);
      say(loginPortal === 'company' ? 'Company account created. Your access request is waiting for Kariqo approval.' : 'Account created successfully!', 'success');
      return 'Account created.';
    }

    return loginPortal === 'company'
      ? 'Company account created. Confirm your email, then sign in to check your access request.'
      : 'Account created! Please check your email inbox to confirm your account, then sign in.';
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser('');
    setEmail('');
    setUserId('');
    setAccountType('student');
    setAuth(true);
    say('Signed out', 'info');
  };

  const membershipActive = Boolean(
    membership &&
      (membership.status === 'active' ||
        (membership.status === 'cancelled' && membership.current_end && new Date(membership.current_end).getTime() > Date.now())),
  );

  const checkMembership = async () => {
    if (!supabase) return say('Kariqo backend is not connected', 'error');
    setMembershipBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('membership-status', { body: {} });
      if (error) throw error;
      if (data?.status && data.status !== 'none') setMembership({ status: data.status, current_end: data.currentEnd || null });
      else setMembership(null);
      if (data?.active) say('Subscription active — Mentor and Live Classes unlocked', 'success');
      else say('Payment is not confirmed yet. If you just paid, try again shortly.', 'info');
    } catch (e) {
      say(dbMessage(e, 'Could not check subscription status'), 'error');
    } finally {
      setMembershipBusy(false);
    }
  };

  const subscribe = async () => {
    if (!supabase) return say('Kariqo backend is not connected', 'error');
    setMembershipBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-membership-subscription', { body: {} });
      if (error) throw error;
      if (data?.active) {
        await checkMembership();
        return;
      }
      if (!data?.checkoutUrl) throw new Error(data?.error || 'Subscription checkout is not ready');
      const handler = (window as Window & { webkit?: { messageHandlers?: { openCheckout?: { postMessage: (url: string) => void } } } })
        .webkit?.messageHandlers?.openCheckout;
      if (handler) handler.postMessage(data.checkoutUrl);
      else window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
      say('Checkout opened. After payment, return here and check your subscription.', 'info');
    } catch (e) {
      say(dbMessage(e, 'Could not start subscription checkout'), 'error');
    } finally {
      setMembershipBusy(false);
    }
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
      if (file.size > 12 * 1024 * 1024) throw new Error('Photo must be smaller than 12 MB');

      const optimized = await optimizePhoto(file);
      if (supabase) {
        const {
          data: { user: current },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!current) throw new Error('Sign in again before changing your photo');

        const path = `${current.id}/avatar-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('avatars').upload(path, optimized, {
          upsert: false,
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });
        if (error) throw error;

        const { error: profileError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', current.id);
        if (profileError) throw profileError;

        const { data, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 30);
        if (signedError) throw signedError;
        if (!data?.signedUrl) throw new Error('Photo saved, but its preview could not be loaded');

        setPhoto(data.signedUrl);
        say('Profile photo saved to your account', 'success');
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const v = String(reader.result);
          setPhoto(v);
          storage.setItem('sk-photo', v);
          say('Profile photo updated', 'success');
        };
        reader.readAsDataURL(optimized);
      }
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not upload photo', 'error');
    } finally {
      input.value = '';
    }
  };

  const refresh = async () => {
    if (supabase && userId) {
      const [skillsResult, projectsResult, roadmapsResult, profileResult, jobOffersResult, interviewSessionsResult, attendanceResult, assignmentScoresResult, applicationsResult] = await Promise.all([
        supabase.from('skills').select('*').eq('user_id', userId).order('name'),
        supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('roadmaps').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('skillora_job_offers').select('id,status,match_score,created_at,company_name,job_title,job_location').eq('student_id', userId).order('created_at', { ascending: false }),
        supabase.from('skillvo_interview_practice').select('*').eq('user_id', userId).order('practice_date', { ascending: false }),
        supabase.from('class_registrations').select('class_id,attendance_status,attended_at').eq('user_id', userId),
        supabase.from('mentor_assignment_submissions').select('score,reviewed_at').eq('student_id', userId).not('score', 'is', null).order('reviewed_at', { ascending: false, nullsFirst: false }),
        supabase.from('skillvo_job_applications').select('*').eq('student_id', userId).order('updated_at', { ascending: false }),
      ]);

      setRecords((r) => ({
        ...r,
        skills: skillsResult.data || [],
        projects: projectsResult.data || [],
        roadmaps: roadmapsResult.data || [],
        profile: profileResult.data || r.profile,
        jobOffers: jobOffersResult.data || [],
        interviewSessions: interviewSessionsResult.data || [],
        attendance: attendanceResult.data || [],
        assignmentScores: assignmentScoresResult.data || [],
        applications: applicationsResult.data || [],
      }));

      if (profileResult.data?.career_goal) {
        setGoal(profileResult.data.career_goal);
      }
    }
  };

  useEffect(() => {
    const client = supabase;
    if (!client || auth || accountType !== 'student' || !userId) return;
    let active = true;
    const syncOffers = async () => {
      if (!active || document.visibilityState !== 'visible') return;
      const { data, error } = await client
        .from('skillora_job_offers')
        .select('id,status,match_score,created_at,company_name,job_title,job_location')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });
      if (!active || error) return;
      setRecords((current) => ({ ...current, jobOffers: data || [] }));
    };
    const onFocus = () => void syncOffers();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void syncOffers(); };
    const timer = window.setInterval(() => void syncOffers(), 60_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [accountType, auth, userId]);

  const saveProfile = async (patch: Record<string, unknown>) => {
    if (!supabase || !userId) return;
    const { error } = await supabase.from('profiles').upsert({ id: userId, ...patch });
    if (error) throw error;
    setRecords((r) => ({ ...r, profile: { ...r.profile, ...patch } }));
    if (typeof patch.full_name === 'string' && patch.full_name) setUser(patch.full_name);
    if (typeof patch.career_goal === 'string' && patch.career_goal) setGoal(patch.career_goal);
  };

  const ctx: Ctx = {
    user,
    email,
    photo,
    goal,
    setGoal,
    upload,
    say,
    notices,
    setNotices,
    setPage,
    logout,
    records,
    userId,
    membershipActive,
    membershipLoading,
    membershipBusy,
    subscribe,
    checkMembership,
    refresh,
    saveProfile,
  };

  if (!backendReady) return <BackendSetup />;
  if (auth) return <Login login={login} register={register} portal={loginPortal} onPortalChange={(next) => {
    setLoginPortal(next);
    const url = new URL(window.location.href);
    if (next === 'student') url.searchParams.delete('portal');
    else url.searchParams.set('portal', next);
    window.history.replaceState({}, '', url);
  }} />;
  if (accountType === 'mentor') return <MentorPortal user={user} email={email} userId={userId} logout={logout} say={say} toast={toast} />;
  if (accountType === 'owner') return <OwnerDashboard user={user} ownerProfile={records.profile} email={email} logout={logout} say={say} toast={toast} />;
  if (accountType === 'company') return <CompanyDashboard user={user} email={email} logout={logout} say={say} toast={toast} />;

  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? 'opened' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Sparkles />
          </div>
          <div>
            <b>Kariqo</b>
            <small>
              by <strong>Brain Strom</strong>
            </small>
          </div>
          <button className="mobile-x" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <div className="team-chip">
          <span>BS</span>
          <div>
            <b>Brain Strom</b>
            <small>Student workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {['Workspace', 'Discover', 'Updates', 'Support', 'Account'].map((g) => (
            <section key={g}>
              <label>{g}</label>
              {links
                .filter((x) => x.group === g)
                .map((x) => (
                  <button
                    key={x.name}
                    className={`nav-link ${page === x.name ? 'selected' : ''}`}
                    onClick={() => {
                      setPage(x.name);
                      setMenu(false);
                    }}
                  >
                    <x.icon size={17} />
                    {x.name}
                    {x.name === 'Notifications' && <i>{notices.filter((n) => n.unread).length}</i>}
                  </button>
                ))}
            </section>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="help">
            <CircleHelp />
            <b>Need a hand?</b>
            <p>Our support team is here for you.</p>
            <button onClick={() => setPage('Customer Care')}>
              Get support <ArrowRight size={14} />
            </button>
          </div>
          <button className="mini-user" onClick={() => setPage('Profile & Settings')}>
            <Avatar user={user} photo={photo} />
            <span>
              <b>{user}</b>
              <small>Student account</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>

      <main>
        <header>
          <button className="hamburger" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="crumb">
            Workspace <span>/</span> <b>{page}</b>
          </div>
          <div className="head-actions">
            <div className="search">
              <Search size={16} />
              <input
                placeholder="Search anything..."
                onKeyDown={(e) => e.key === 'Enter' && say('Search is ready for your workspace', 'info')}
              />
              <kbd>⌘ K</kbd>
            </div>
            <button className="bell" onClick={() => setPop(!pop)}>
              <Bell size={19} />
              <i>{notices.filter((n) => n.unread).length}</i>
            </button>
            <button className="user-short" onClick={() => setPage('Profile & Settings')}>
              <Avatar user={user} photo={photo} />
              <ChevronDown size={14} />
            </button>
          </div>
          {pop && (
            <div className="pop">
              <div>
                <b>Notifications</b>
                <button
                  onClick={async () => {
                    if (supabase && userId) {
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
                    }
                    setNotices(notices.map((n) => ({ ...n, unread: false })));
                  }}
                >
                  Mark all read
                </button>
              </div>
              {notices.map((n) => (
                <article key={n.title}>
                  <i className={n.unread ? 'dot' : ''} />
                  <span>
                    <b>{n.title}</b>
                    <p>{n.detail}</p>
                    <small>{n.time}</small>
                  </span>
                </article>
              ))}
              <button
                className="see-all"
                onClick={() => {
                  setPage('Notifications');
                  setPop(false);
                }}
              >
                See all notifications <ArrowRight size={14} />
              </button>
            </div>
          )}
        </header>

        <div className="body app-view-enter" key={page}>{render(page, ctx)}</div>

      <footer>
          <span>© 2025 Kariqo · Learn. Build. Prove. Connect.</span>
          <span>
            Made for students, by <b>Brain Strom</b>
          </span>
      </footer>

      <KariqoBuddy profile={records.profile} roadmap={records.roadmaps[0]} userId={userId} setPage={setPage} offers={records.jobOffers} skillScores={records.skills} assignmentScores={records.assignmentScores} notices={notices} announcements={records.announcements} />
      </main>

      {toast && (
        <div
          className="toast"
          style={{
            borderColor: toast.type === 'error' ? '#f87171' : toast.type === 'info' ? '#818cf8' : '#34d399',
          }}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={17} style={{ color: '#f87171' }} />
          ) : toast.type === 'info' ? (
            <Sparkles size={17} style={{ color: '#a5b4fc' }} />
          ) : (
            <Check size={17} style={{ color: '#34d399' }} />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

function KariqoBuddy({ profile, roadmap, userId, setPage, offers, skillScores, assignmentScores, notices, announcements }: {
  profile: Record<string, any>;
  roadmap?: Record<string, any>;
  userId: string;
  setPage: (page: Page) => void;
  offers: Record<string, any>[];
  skillScores: Record<string, any>[];
  assignmentScores: Record<string, any>[];
  notices: Notice[];
  announcements: Record<string, any>[];
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [curious, setCurious] = useState(false);
  const [appreciating, setAppreciating] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const wasDragged = useRef(false);
  const [newOffer, setNewOffer] = useState<Record<string, any> | null>(null);
  const [hydrationReminder, setHydrationReminder] = useState(false);
  const latestOffer = offers[0];
  const offerMood = Boolean(newOffer);
  const scoredAssignments = assignmentScores.map((item) => Number(item.score)).filter(Number.isFinite);
  const selfRatedSkills = skillScores.map((item) => Number(item.score)).filter(Number.isFinite);
  const latestReviewedScore = scoredAssignments[0];
  const skillAverage = selfRatedSkills.length ? selfRatedSkills.reduce((sum, score) => sum + score, 0) / selfRatedSkills.length : null;
  const performanceLow = latestReviewedScore !== undefined ? latestReviewedScore < 50 : skillAverage !== null && skillAverage < 40;
  const performanceGood = latestReviewedScore !== undefined ? latestReviewedScore >= 75 : skillAverage !== null && skillAverage >= 75;
  const mood: 'neutral' | 'excited' | 'supportive' | 'angry' = offerMood || appreciating || performanceGood ? 'excited' : performanceLow ? 'angry' : 'neutral';
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const taskKey = `kariqo-kiko-task:${userId}:${todayKey}`;
  const [taskDone, setTaskDone] = useState(() => Boolean(userId && storage.getItem(taskKey) === 'done'));
  const name = (profile.full_name || '').split(' ')[0];
  const roadmapContent = roadmap?.content || {};
  const roadmapTask = String(roadmapContent.next_action || roadmapContent.weeks?.[0]?.activities?.[0] || '').trim();
  const todayTask = roadmapTask || (profile.career_goal ? `Spend 15 minutes building one small skill for ${profile.career_goal}.` : 'Add a career goal, then choose one skill to practise for 15 minutes.');

  useEffect(() => {
    setVisible(storage.getItem(`kariqo-kiko-hidden:${userId}`) !== 'true');
    const handleVisibility = (event: Event) => setVisible((event as CustomEvent<boolean>).detail);
    window.addEventListener('kariqo-kiko-visibility', handleVisibility);
    return () => window.removeEventListener('kariqo-kiko-visibility', handleVisibility);
  }, [userId]);

  const appreciateStudent = () => {
    storage.setItem(taskKey, 'done');
    setTaskDone(true);
    setAppreciating(true);
    window.setTimeout(() => setAppreciating(false), 850);
  };

  useEffect(() => {
    setTaskDone(Boolean(userId && storage.getItem(taskKey) === 'done'));
  }, [taskKey, userId]);

  useEffect(() => {
    if (!userId || !latestOffer?.id) return;
    const seenKey = `kariqo-kiko-last-offer:${userId}`;
    const previouslySeen = storage.getItem(seenKey);
    storage.setItem(seenKey, String(latestOffer.id));
    if (previouslySeen === String(latestOffer.id)) return;

    const isRecent = Date.now() - new Date(latestOffer.created_at || 0).getTime() <= 7 * 24 * 60 * 60 * 1000;
    if (!previouslySeen && !isRecent) return;

    setNewOffer(latestOffer);
    setOpen(true);
  }, [latestOffer?.id, userId]);

  useEffect(() => {
    if (!newOffer) return;
    const timer = setTimeout(() => setNewOffer(null), 12000);
    return () => clearTimeout(timer);
  }, [newOffer]);

  useEffect(() => {
    if (!userId) return;
    let activeMs = 0;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden) activeMs += now - lastTick;
      lastTick = now;
      if (activeMs >= 45 * 60 * 1000) {
        activeMs = 0;
        setHydrationReminder(true);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [userId]);

  useEffect(() => {
    if (!hydrationReminder || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance('Hey! Quick water break. Take a sip of water, then we can keep going.');
    speech.lang = 'en-IN'; speech.pitch = 1.16; speech.rate = 0.94;
    const voices = window.speechSynthesis.getVoices();
    speech.voice = voices.find((voice) => /female|samantha|karen|zira|google.*english.*female/i.test(voice.name)) || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-in')) || null;
    window.speechSynthesis.speak(speech);
    return () => window.speechSynthesis.cancel();
  }, [hydrationReminder]);

  if (!visible) return null;

  return (
    <>
    <div className={`kariqo-buddy ${open ? 'is-open' : ''} ${isMoving ? 'is-moving' : ''}`} style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}>
      {open && <section className={`kariqo-buddy-card mood-${mood}`} aria-label="Kiko learning companion">
        <div className="kariqo-buddy-card-head"><div className={`kariqo-buddy-avatar mood-${mood}`}><BuddyCreature mood={mood} appreciating={appreciating} /></div><div><small>KARIQO COMPANION</small><b>Kiko{ name ? ` · Hi ${name}!` : ''}</b></div><button aria-label="Close Kiko" onClick={() => setOpen(false)}><X size={16} /></button></div>
        {newOffer ? <div className="kiko-mood-message excited" role="status"><b>It’s offer time! 🎉</b><span>{newOffer.company_name || 'A company'} sent you an offer for {newOffer.job_title || 'a role'}. Congratulations, {name || 'you'}! Kiko is so proud of you.</span><button onClick={() => { setPage('Job Offers'); setOpen(false); }}>See your offer <ArrowRight size={13} /></button></div> : performanceLow && <div className="kiko-mood-message supportive"><b>That looks like a tough stretch.</b><span>One result doesn’t define you. Let’s pick one small thing to practise — Kiko is cheering you on.</span><button onClick={() => { setPage('AI Roadmap'); setOpen(false); }}>Find one small next step <ArrowRight size={13} /></button></div>}
        <div className={`kiko-daily-task ${taskDone ? 'completed' : ''}`}><div><small>TODAY’S ROADMAP STEP</small><p>{todayTask}</p></div>{taskDone ? <strong><Check size={13} /> Done!</strong> : <button onClick={appreciateStudent}>Mark done</button>}</div>
        {taskDone && <div className="kiko-celebration" role="status">You showed up for your goal today. Small steps count — Kiko is proud of you! ✨</div>}
        <section className="kiko-updates" aria-label="Recent notifications and announcements">
          <div className="kiko-updates-heading"><b>Quick updates</b><button onClick={() => { setPage('Notifications'); setOpen(false); }}>See all <ArrowRight size={12} /></button></div>
          {notices.slice(0, 2).map((notice, index) => <button className="kiko-update-row" key={notice.id || `${notice.title}-${index}`} onClick={() => { setPage('Notifications'); setOpen(false); }}><span className={`kiko-update-dot ${notice.unread ? 'unread' : ''}`} /><span><b>{notice.title}</b><small>{notice.detail}</small></span></button>)}
          {announcements.slice(0, 2).map((announcement) => <button className="kiko-update-row" key={announcement.id} onClick={() => { setPage('Announcements'); setOpen(false); }}><span className="kiko-update-dot announcement" /><span><b>{announcement.title}</b><small>{announcement.body}</small></span></button>)}
          {!notices.length && !announcements.length && <p className="kiko-no-updates">No new updates right now.</p>}
        </section>
        <div className="kiko-quick-links"><button onClick={() => { setPage('AI Roadmap'); setOpen(false); }}><Compass size={13} /> Roadmap</button><button onClick={() => { setPage('Announcements'); setOpen(false); }}><MessageCircle size={13} /> Announcements</button></div>
        <button className="kiko-hide-button" onClick={() => { storage.setItem(`kariqo-kiko-hidden:${userId}`, 'true'); setVisible(false); setOpen(false); }}>Hide Kiko</button>
      </section>}
      <button className={`kariqo-buddy-launch mood-${mood}`} aria-label={open ? 'Close Kiko companion' : offerMood ? 'Kiko celebrates your new job offer' : performanceLow ? 'Kiko is here to encourage you' : 'Open Kiko companion'} aria-expanded={open} onMouseEnter={() => setCurious(true)} onMouseLeave={() => setCurious(false)} onPointerDown={(event) => { if (event.button !== 0) return; dragOrigin.current = { x: event.clientX, y: event.clientY, offsetX: dragOffset.x, offsetY: dragOffset.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const origin = dragOrigin.current; if (!origin) return; const dx = event.clientX - origin.x; const dy = event.clientY - origin.y; if (Math.abs(dx) + Math.abs(dy) > 4) wasDragged.current = true; if (wasDragged.current) { setIsMoving(true); setDragOffset({ x: origin.offsetX + dx, y: origin.offsetY + dy }); } }} onPointerUp={() => { dragOrigin.current = null; setIsMoving(false); }} onPointerCancel={() => { dragOrigin.current = null; setIsMoving(false); }} onClick={() => { if (wasDragged.current) { wasDragged.current = false; return; } setOpen(!open); }}>
        <span className={`kariqo-buddy-creature mood-${mood} ${curious ? 'is-curious' : ''}`}><BuddyCreature mood={mood} curious={curious} appreciating={appreciating} /></span>
      </button>
    </div>
    {hydrationReminder && createPortal(<div className="kiko-hydration-overlay" role="dialog" aria-modal="true" aria-label="Kiko hydration reminder"><section><div className="kiko-hydration-walker"><BuddyCreature mood="excited" /></div><small>KIKO · QUICK RESET</small><h2>Water break!</h2><p>Take a sip of water and rest your eyes for a moment. You’ve been learning for 45 minutes.</p><button className="primary" onClick={() => setHydrationReminder(false)}>Done · back to learning <ArrowRight size={14} /></button></section></div>, document.body)}
    </>
  );
}

function BuddyCreature({ mood = 'neutral', curious = false, appreciating = false }: { mood?: 'neutral' | 'excited' | 'supportive' | 'angry'; curious?: boolean; appreciating?: boolean }) {
  return <svg viewBox="0 0 80 88" role="img" aria-label={`${curious ? 'curious' : mood} Kiko mascot`} className={`buddy-creature-svg mood-${mood} ${curious ? 'is-curious' : ''} ${appreciating ? 'is-appreciating' : ''}`}>
    <ellipse className="buddy-shadow" cx="40" cy="82" rx="18" ry="4" />
    <path className="buddy-tail" d="M52 65c14 1 17 13 8 17-5 2-9-1-9-5 0-2 2-4 4-3" />
    <g className="buddy-pet-body">
      <path className="buddy-leg buddy-leg-left" d="M31 69v7c-5 1-7 3-6 6 1 2 9 2 13 0v-8" />
      <path className="buddy-leg buddy-leg-right" d="M47 69v7c5 1 7 3 6 6-1 2-9 2-13 0v-8" />
      <ellipse className="buddy-tummy" cx="40" cy="64" rx="17" ry="18" />
      <path className="buddy-arm buddy-arm-left" d="M26 54c-7 2-9 8-7 13 1 3 4 4 7 2l7-8" />
      <path className="buddy-arm buddy-arm-right" d="M54 54c7 2 9 8 7 13-1 3-4 4-7 2l-7-8" />
      <path className="buddy-belly" d="M31 63c0-7 4-11 9-11s9 4 9 11v8H31Z" />
      <path className="buddy-paw" d="M21 65c-3 0-5 2-4 5s6 3 9 0l1-3M59 65c3 0 5 2 4 5s-6 3-9 0l-1-3" />
    </g>
    <g className="buddy-pet-head">
      <path className="buddy-ear" d="M22 25 17 9l16 9M58 25l5-16-16 9" />
      <path className="buddy-body" d="M15 34c0-15 10-25 25-25s25 10 25 25-10 26-25 26-25-11-25-26Z" />
      <path className="buddy-cheek" d="M21 42c4 2 7 2 10 0M49 42c3 2 6 2 10 0" />
      {mood === 'supportive' && <path className="buddy-brow" d="m24 28 7 2M49 30l7-2" />}
      {mood === 'angry' && <path className="buddy-brow" d="m24 27 7 4M49 31l7-4" />}
      {curious && mood === 'neutral' && <path className="buddy-brow buddy-curious-brow" d="m24 28 7-2M49 26l7 2" />}
      <ellipse className="buddy-eye" cx="31" cy="34" rx={curious && mood === 'neutral' ? '3.4' : '2.7'} ry={mood === 'excited' ? '4.4' : mood === 'angry' ? '2.3' : '3.8'} transform={mood === 'angry' ? 'rotate(-12 31 34)' : undefined} />
      <ellipse className="buddy-eye" cx="49" cy="34" rx={curious && mood === 'neutral' ? '3.4' : '2.7'} ry={mood === 'excited' ? '4.4' : mood === 'angry' ? '2.3' : '3.8'} transform={mood === 'angry' ? 'rotate(12 49 34)' : undefined} />
      {mood === 'excited' ? <path className="buddy-smile" d="M30 42c4 7 16 7 20 0" /> : mood === 'supportive' ? <path className="buddy-smile" d="M32 48c4-5 12-5 16 0" /> : mood === 'angry' ? <path className="buddy-smile" d="M32 41Q40 52 48 41" /> : curious ? <ellipse className="buddy-curious-mouth" cx="40" cy="44" rx="3" ry="4" /> : <path className="buddy-smile" d="M34 43c3 4 9 4 12 0" />}
      {mood === 'supportive' && <path className="buddy-tear" d="M58 43c0 2-2 3-2 5a2 2 0 0 0 4 0c0-2-2-3-2-5Z" />}
      {mood === 'excited' ? <g className="buddy-celebration"><path d="m40 1 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5ZM8 26l1.3 3 3 1.3-3 1.3L8 35l-1.3-3.4-3-1.3 3-1.3L8 26ZM72 19l1.3 3 3 1.3-3 1.3L72 28l-1.3-3.4-3-1.3 3-1.3L72 19Z" /></g> : <path className="buddy-star" d="m40 4 1.5 3.5L45 9l-3.5 1.5L40 14l-1.5-3.5L35 9l3.5-1.5L40 4Z" />}
    </g>
  </svg>;
}

function Avatar({ user, photo }: { user: string; photo: string }) {
  return photo ? (
    <img className="avatar" src={photo} alt="Profile" />
  ) : (
    <span className="avatar">
      {(user || 'Student')
        .split(' ')
        .map((a) => a[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </span>
  );
}

async function optimizePhoto(file: File): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('This image could not be opened'));
      img.src = source;
    });

    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this photo');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare this photo'))), 'image/jpeg', 0.86),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}

function BackendSetup() {
  return (
    <div className="login">
      <section className="login-art">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles />
          </div>
          <div>
            <b>Kariqo</b>
            <small>
              by <strong>Brain Strom</strong>
            </small>
          </div>
        </div>
        <div className="login-message">
          <small>✳ &nbsp; KARIQO WORKSPACE</small>
          <h1>
            One place to
            <br />
            <em>grow forward.</em>
          </h1>
          <p>Your account, progress, projects, and learning plan live in your private workspace.</p>
        </div>
        <small className="login-copy">© 2025 Kariqo · Learn. Build. Prove. Connect.</small>
      </section>
      <section className="login-side">
        <div className="login-symbol">
          <Sparkles />
        </div>
        <small>BACKEND CONNECTION REQUIRED</small>
        <h2>Connect Kariqo</h2>
        <p>This app needs a Supabase project connection before accounts and workspace data can be used.</p>
        <div className="secure">
          <ShieldCheck size={15} /> No demo sign-in is available in this build.
        </div>
        <div className="credit">
          A student success platform by <b>Brain Strom</b>
        </div>
      </section>
    </div>
  );
}

function Login({
  login,
  register,
  portal,
  onPortalChange,
}: {
  login: (e: FormEvent<HTMLFormElement>) => Promise<string>;
  register: (e: FormEvent<HTMLFormElement>) => Promise<string>;
  portal: 'student' | 'mentor' | 'owner' | 'company';
  onPortalChange: (portal: 'student' | 'mentor' | 'owner' | 'company') => void;
}) {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const res = creating ? await register(e) : await login(e);
      if (res) {
        setMessage(res);
        setIsError(!res.toLowerCase().includes('account created'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <section className="login-art">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles />
          </div>
          <div>
            <b>Kariqo</b>
            <small>
              by <strong>Brain Strom</strong>
            </small>
          </div>
        </div>
        <div className="login-message">
          <small>✳ &nbsp; YOUR SKILLS, YOUR FUTURE</small>
          <h1>
            Make your skills
            <br />
            <em>go further.</em>
          </h1>
          <p>One connected journey from learning what matters to proving what you can do.</p>
          <div className="journey">
            <span>
              01 <b>Discover your strengths</b>
            </span>
            <ArrowRight />
            <span>
              02 <b>Build your next skill</b>
            </span>
            <ArrowRight />
            <span>
              03 <b>Connect to opportunity</b>
            </span>
          </div>
        </div>
        <small className="login-copy">© 2025 Kariqo · Learn. Build. Prove. Connect.</small>
      </section>

      <section className="login-side">
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="account_type" value={portal} />
          <div className="login-symbol">
            {portal === 'mentor' ? <CalendarDays /> : portal === 'owner' ? <ShieldCheck /> : portal === 'company' ? <Building2 /> : <Sparkles />}
          </div>
          <small>{portal === 'mentor' ? 'KARIQO MENTOR PORTAL' : portal === 'owner' ? 'KARIQO MANAGEMENT' : portal === 'company' ? 'KARIQO COMPANY PORTAL' : 'WELCOME TO KARIQO'}</small>
          <h2>{portal === 'owner' ? 'Owner sign in' : portal === 'company' ? 'Company sign in' : creating ? `Create ${portal} account` : `${portal === 'mentor' ? 'Mentor' : 'Student'} sign in`}</h2>
          <p>{portal === 'owner' ? 'Sign in with the approved Kariqo owner account to manage subscriptions and app activity.' : portal === 'company' ? 'Approved employers can post job requirements and find students who have shared their interview-ready profile.' : creating ? (portal === 'mentor' ? 'Create your mentor account to schedule and teach live classes.' : 'Start your own private Kariqo workspace.') : (portal === 'mentor' ? 'Sign in to manage and teach your Kariqo classes.' : 'Use your Kariqo account to continue.')}</p>

          {creating && portal !== 'owner' && (
            <label>
              Your name
              <input name="name" autoComplete="name" placeholder={portal === 'mentor' ? 'Mentor name' : portal === 'company' ? 'Contact person' : 'Student name'} required />
            </label>
          )}
          {creating && portal === 'company' && <label>Company name<input name="company_name" autoComplete="organization" placeholder="Your registered company name" minLength={2} maxLength={120} required /></label>}

          <label>
            Email address
            <input name="email" type="email" autoComplete="email" placeholder="name@college.edu" required />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={creating ? 'new-password' : 'current-password'}
              minLength={8}
              placeholder="Minimum 8 characters"
              required
            />
          </label>

          <div className="remember">
            <span>Secure Supabase sign-in</span>
            {portal !== 'owner' && <button
              type="button"
              onClick={() => {
                setCreating(!creating);
                setMessage('');
              }}
            >
              {creating ? 'I already have an account' : 'Create account'}
            </button>}
          </div>

          <div className="portal-switch">
            {portal === 'owner' || portal === 'company' ? 'Go to student workspace?' : portal === 'mentor' ? 'Are you a student?' : 'Are you teaching a class?'}{' '}
            <button type="button" onClick={() => { onPortalChange(portal === 'student' ? 'mentor' : 'student'); setCreating(false); setMessage(''); }}>
              {portal === 'student' ? 'Mentor sign in' : 'Student sign in'}
            </button>
          </div>
          {portal === 'student' && <button type="button" className="owner-login-link" onClick={() => { onPortalChange('owner'); setCreating(false); setMessage(''); }}>Owner management sign in</button>}
          {portal === 'owner' && <div className="owner-login-note">Owner access is provisioned by the project administrator. New owner accounts cannot be created from this page.</div>}
          {portal === 'student' && <button type="button" className="owner-login-link" onClick={() => { onPortalChange('company'); setCreating(false); setMessage(''); }}>Company / recruiter sign in</button>}
          {portal === 'company' && <div className="owner-login-note">New companies can request access. Kariqo management reviews each request before any student profile is shared.</div>}

          <button className="primary full" disabled={submitting}>
            {submitting ? 'Please wait…' : creating ? 'Create account' : 'Sign in'} <ArrowRight size={16} />
          </button>

          {message && (
            <div
              className="secure"
              style={{
                color: isError ? '#dc2626' : '#15803d',
                background: isError ? '#fef2f2' : '#f0fdf4',
                padding: '10px',
                borderRadius: '8px',
                marginTop: '14px',
                fontSize: '11px',
                lineHeight: '1.4',
              }}
            >
              {isError ? <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} /> : <Check size={16} style={{ color: '#15803d', flexShrink: 0 }} />}
              <span>{message}</span>
            </div>
          )}

          <div className="secure">
            <ShieldCheck size={15} /> Your account and workspace data are protected by Supabase.
          </div>
          <div className="credit">
            A student success platform by <b>Brain Strom</b>
          </div>
        </form>
      </section>
    </div>
  );
}

type Ctx = {
  user: string;
  email: string;
  photo: string;
  goal: string;
  setGoal: (s: string) => void;
  upload: (e: ChangeEvent<HTMLInputElement>) => void;
  say: (s: string, type?: 'success' | 'error' | 'info') => void;
  notices: Notice[];
  setNotices: (n: Notice[]) => void;
  setPage: (p: Page) => void;
  logout: () => void;
  records: Records;
  userId: string;
  membershipActive: boolean;
  membershipLoading: boolean;
  membershipBusy: boolean;
  subscribe: () => Promise<void>;
  checkMembership: () => Promise<void>;
  refresh: () => Promise<void>;
  saveProfile: (patch: Record<string, unknown>) => Promise<void>;
};

function MentorPortal({ user, email, userId, logout, say, toast }: {
  user: string;
  email: string;
  userId: string;
  logout: () => Promise<void>;
  say: (message: string, type?: 'success' | 'error' | 'info') => void;
  toast: ToastState | null;
}) {
  const [classes, setClasses] = useState<Record<string, any>[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<Record<string, any>[]>([]);
  const [classMaterials, setClassMaterials] = useState<Record<string, any>[]>([]);
  const [classAssignments, setClassAssignments] = useState<Record<string, any>[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<Record<string, any>[]>([]);
  const [studentSkillRows, setStudentSkillRows] = useState<Record<string, any>[]>([]);
  const [classNotes, setClassNotes] = useState<Record<string, any>[]>([]);
  const [mentorQuestions, setMentorQuestions] = useState<Record<string, any>[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<Record<string, any> | null>(null);
  const [mentorProfile, setMentorProfile] = useState<Record<string, any> | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeRoom, setActiveRoom] = useState<{ id: string; title: string } | null>(null);

  const refreshClasses = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('live_classes').select('*').eq('instructor_id', userId).order('starts_at');
    if (error) say(error.message, 'error');
    else {
      const classRows = data || [];
      setClasses(classRows);
      const classIds = classRows.map((item) => item.id);
      if (!classIds.length) { setAttendanceRows([]); setClassMaterials([]); setClassAssignments([]); setAssignmentSubmissions([]); setStudentSkillRows([]); setClassNotes([]); }
      else {
        const [registrationResult, materialsResult, assignmentsResult, notesResult] = await Promise.all([
          supabase.from('class_registrations').select('user_id,class_id,attendance_status,attended_at,created_at').in('class_id', classIds),
          supabase.from('mentor_class_materials').select('*').in('class_id', classIds).order('created_at', { ascending: false }),
          supabase.from('mentor_class_assignments').select('*').in('class_id', classIds).order('created_at', { ascending: false }),
          supabase.from('mentor_class_notes').select('*').in('class_id', classIds),
        ]);
        if (notesResult.error) say(`Could not load class notes: ${notesResult.error.message}`, 'error');
        else setClassNotes(notesResult.data || []);
        const registrations = registrationResult.data;
        const registrationError = registrationResult.error;
        if (registrationError) say(`Could not load attendance: ${registrationError.message}`, 'error');
        else {
          const studentIds = [...new Set((registrations || []).map((item) => item.user_id))];
          const [{ data: profiles, error: profilesError }, { data: skills, error: skillsError }] = studentIds.length
            ? await Promise.all([
                supabase.from('profiles').select('id,full_name').in('id', studentIds),
                supabase.from('skills').select('user_id,name,score').in('user_id', studentIds),
              ])
            : [{ data: [], error: null }, { data: [], error: null }];
          if (profilesError) say(`Could not load student names: ${profilesError.message}`, 'error');
          if (skillsError) say(`Could not load student skill gaps: ${skillsError.message}`, 'error');
          const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));
          setAttendanceRows((registrations || []).map((item) => ({ ...item, student_name: names.get(item.user_id) || 'Student' })));
          setStudentSkillRows(skills || []);
        }
        if (materialsResult.error) say(`Could not load class materials: ${materialsResult.error.message}`, 'error');
        else setClassMaterials(await addMaterialAccessUrls(materialsResult.data || []));
        if (assignmentsResult.error) say(`Could not load assignments: ${assignmentsResult.error.message}`, 'error');
        else {
          const assignmentRows = assignmentsResult.data || [];
          setClassAssignments(assignmentRows);
          const assignmentIds = assignmentRows.map((item) => item.id);
          if (!assignmentIds.length) setAssignmentSubmissions([]);
          else {
            const { data: submissions, error: submissionsError } = await supabase.from('mentor_assignment_submissions').select('*').in('assignment_id', assignmentIds).order('submitted_at', { ascending: false });
            if (submissionsError) say(`Could not load assignment submissions: ${submissionsError.message}`, 'error');
            else {
              const studentIds = [...new Set((submissions || []).map((item) => item.student_id))];
              const { data: profiles } = studentIds.length ? await supabase.from('profiles').select('id,full_name').in('id', studentIds) : { data: [] as any[] };
              const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));
              setAssignmentSubmissions((submissions || []).map((item) => ({ ...item, student_name: names.get(item.student_id) || 'Student' })));
            }
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { void refreshClasses(); }, [userId]);

  const refreshMentorProfile = async () => {
    if (!supabase) { setProfileLoading(false); return; }
    const { data, error } = await supabase.from('mentors').select('*').eq('user_id', userId).maybeSingle();
    if (error) say(`Could not load your mentor profile: ${error.message}`, 'error');
    else setMentorProfile(data || null);
    setProfileLoading(false);
  };

  useEffect(() => { void refreshMentorProfile(); }, [userId]);

  const loadMentorQuestions = async () => {
    if (!supabase || !mentorProfile?.id) { setMentorQuestions([]); return; }
    const { data, error } = await supabase.from('mentor_doubt_threads').select('*').eq('mentor_id', mentorProfile.id).order('updated_at', { ascending: false });
    if (error) { say(`Could not load student questions: ${error.message}`, 'error'); return; }
    const threads = data || [];
    const threadIds = threads.map((thread) => thread.id);
    const { data: messageRows } = threadIds.length ? await supabase.from('mentor_doubt_messages').select('*').in('thread_id', threadIds).order('created_at', { ascending: false }) : { data: [] as any[] };
    const latest = new Map<string, Record<string, any>>();
    (messageRows || []).forEach((message) => { if (!latest.has(message.thread_id)) latest.set(message.thread_id, message); });
    const studentIds = [...new Set(threads.map((thread) => thread.student_id))];
    const { data: profiles } = studentIds.length ? await supabase.from('profiles').select('id,full_name').in('id', studentIds) : { data: [] as any[] };
    const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));
    setMentorQuestions(threads.map((thread) => {
      const lastMessage = latest.get(thread.id);
      return { ...thread, student_name: names.get(thread.student_id) || 'Student', latest_message: lastMessage?.body || thread.initial_message, latest_at: lastMessage?.created_at || thread.updated_at || thread.created_at };
    }).sort((a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()));
  };

  useEffect(() => {
    if (!mentorProfile?.id) return;
    void loadMentorQuestions();
    const timer = window.setInterval(() => void loadMentorQuestions(), 12000);
    return () => window.clearInterval(timer);
  }, [mentorProfile?.id]);

  const saveClassNotes = async (event: FormEvent<HTMLFormElement>, classId: string) => {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const notes = String(form.get('notes') || '').trim();
    const recordingUrl = String(form.get('recording_url') || '').trim();
    if (recordingUrl && !/^https:\/\//i.test(recordingUrl)) return say('Recording link must start with https://', 'error');
    setBusy(true);
    const { error } = await supabase.from('mentor_class_notes').upsert({
      class_id: classId, mentor_id: userId, notes, recording_url: recordingUrl, published: form.get('published') === 'on',
    }, { onConflict: 'class_id' });
    setBusy(false);
    if (error) return say(`Could not save class recap: ${error.message}`, 'error');
    say(form.get('published') === 'on' ? 'Class recap saved; students can review it after class ends.' : 'Class recap saved as a draft.', 'success');
    await refreshClasses();
  };

  const saveMentorProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return say('Kariqo backend is not connected', 'error');
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get('full_name') || '').trim();
    const title = String(form.get('title') || '').trim();
    const bio = String(form.get('bio') || '').trim();
    const expertise = String(form.get('expertise') || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12);
    if (!fullName || !title || !bio || !expertise.length) return say('Complete every mentor profile field before publishing.', 'error');
    setBusy(true);
    const { data, error } = await supabase.from('mentors').upsert({
      ...(mentorProfile?.id ? { id: mentorProfile.id } : {}),
      user_id: userId, full_name: fullName, title, bio, expertise,
      published: form.get('published') === 'on',
    }, { onConflict: 'user_id' }).select('*').single();
    setBusy(false);
    if (error) return say(`Could not save your mentor profile: ${error.message}`, 'error');
    setMentorProfile(data);
    say(data.published ? 'Your profile is now visible in the student mentor list.' : 'Mentor profile saved as a draft.', 'success');
  };

  const createClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return say('Kariqo backend is not connected', 'error');
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startsAt = new Date(String(form.get('starts_at')));
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setBusy(false);
      return say('Choose a future date and time for the class', 'error');
    }
    const { error } = await supabase.from('live_classes').insert({
      instructor_id: userId,
      instructor: user,
      title: String(form.get('title')).trim(),
      description: String(form.get('description')).trim(),
      starts_at: startsAt.toISOString(),
      duration_minutes: Number(form.get('duration_minutes')) || 60,
      published: false,
      meeting_url: String(form.get('meeting_url') || '').trim(),
    });
    setBusy(false);
    if (error) return say(error.message, 'error');
    formElement.reset();
    say('Class saved as a draft. Publish it when you are ready.');
    await refreshClasses();
  };

  const publishClass = async (item: Record<string, any>) => {
    if (!supabase) return;
    const { error } = await supabase.from('live_classes').update({ published: !item.published }).eq('id', item.id).eq('instructor_id', userId);
    if (error) return say(error.message, 'error');
    say(item.published ? 'Class unpublished' : 'Class published for students', 'success');
    await refreshClasses();
  };

  const saveMeetingLink = async (event: FormEvent<HTMLFormElement>, item: Record<string, any>) => {
    event.preventDefault();
    if (!supabase) return;
    const meetingUrl = String(new FormData(event.currentTarget).get('meeting_url') || '').trim();
    if (meetingUrl && !isSafeMeetingUrl(meetingUrl)) return say('Use a complete secure https:// meeting link, or leave it blank to use Kariqo’s built-in room.', 'error');
    setBusy(true);
    const { error } = await supabase.from('live_classes').update({ meeting_url: meetingUrl }).eq('id', item.id).eq('instructor_id', userId);
    setBusy(false);
    if (error) return say(`Could not save the class link: ${error.message}`, 'error');
    say(meetingUrl ? 'Meeting link saved. Registered students can join the class.' : 'Kariqo in-app room selected. Registered students can join from Live Classes.', 'success');
    await refreshClasses();
  };

  const markAttendance = async (item: Record<string, any>, status: string) => {
    if (!supabase) return;
    setBusy(true);
    const attendedAt = status === 'present' || status === 'late' ? new Date().toISOString() : null;
    const { error } = await supabase.from('class_registrations').update({ attendance_status: status, attended_at: attendedAt })
      .eq('class_id', item.class_id).eq('user_id', item.user_id);
    setBusy(false);
    if (error) return say(`Could not save attendance: ${error.message}`, 'error');
    setAttendanceRows((rows) => rows.map((row) => row.class_id === item.class_id && row.user_id === item.user_id
      ? { ...row, attendance_status: status, attended_at: attendedAt } : row));
  };

  const addMaterial = async (event: FormEvent<HTMLFormElement>, classId: string) => {
    event.preventDefault(); if (!supabase) return;
    const formElement = event.currentTarget; const form = new FormData(formElement);
    const title = String(form.get('title') || '').trim(); const url = String(form.get('url') || '').trim(); const file = form.get('material_file');
    const uploadFile = file instanceof File && file.size ? file : null;
    if (!url && !uploadFile) return say('Add a web link or choose a file.', 'error');
    if (url && uploadFile) return say('Choose either a web link or a file for one material.', 'error');
    if (uploadFile && uploadFile.size > 15 * 1024 * 1024) return say('Files must be 15 MB or smaller.', 'error');
    setBusy(true);
    let storagePath = '';
    if (uploadFile) {
      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
      storagePath = `${classId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('mentor-class-materials').upload(storagePath, uploadFile, { contentType: uploadFile.type, upsert: false });
      if (uploadError) { setBusy(false); return say(`Could not upload file: ${uploadError.message}`, 'error'); }
    }
    const { error } = await supabase.from('mentor_class_materials').insert({ class_id: classId, title, url: url || '', resource_type: uploadFile ? 'file' : String(form.get('resource_type') || 'link'), ...(storagePath ? { storage_path: storagePath } : {}) });
    if (error && storagePath) await supabase.storage.from('mentor-class-materials').remove([storagePath]);
    setBusy(false); if (error) return say(`Could not add material: ${error.message}`, 'error');
    formElement.reset(); say(uploadFile ? 'Class file uploaded' : 'Class material added', 'success'); await refreshClasses();
  };

  const removeMaterial = async (material: Record<string, any>) => {
    if (!supabase) return;
    setBusy(true);
    if (material.storage_path) {
      const { error } = await supabase.storage.from('mentor-class-materials').remove([material.storage_path]);
      if (error) { setBusy(false); return say(`Could not remove file: ${error.message}`, 'error'); }
    }
    const { error } = await supabase.from('mentor_class_materials').delete().eq('id', material.id);
    setBusy(false); if (error) return say(`Could not remove material: ${error.message}`, 'error');
    say('Class material removed', 'success'); await refreshClasses();
  };

  const addAssignment = async (event: FormEvent<HTMLFormElement>, classId: string) => {
    event.preventDefault(); if (!supabase) return;
    const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true);
    const dueValue = String(form.get('due_at') || '');
    const { error } = await supabase.from('mentor_class_assignments').insert({ class_id: classId, title: String(form.get('title') || '').trim(), instructions: String(form.get('instructions') || '').trim(), due_at: dueValue ? new Date(dueValue).toISOString() : null });
    setBusy(false); if (error) return say(`Could not create assignment: ${error.message}`, 'error');
    formElement.reset(); say('Assignment published to registered students', 'success'); await refreshClasses();
  };

  const reviewSubmission = async (event: FormEvent<HTMLFormElement>, submissionId: string) => {
    event.preventDefault(); if (!supabase) return;
    const form = new FormData(event.currentTarget); const score = String(form.get('score') || ''); const feedback = String(form.get('feedback') || '').trim(); setBusy(true);
    const { error } = await supabase.rpc('review_mentor_assignment_submission', { p_submission_id: submissionId, p_score: score ? Number(score) : null, p_feedback: feedback });
    setBusy(false); if (error) return say(`Could not save feedback: ${error.message}`, 'error');
    say('Feedback sent to student', 'success'); await refreshClasses();
  };

  return (
    <div className="mentor-portal">
      <header className="mentor-topbar">
        <div className="brand"><div className="brand-mark"><CalendarDays /></div><div><b>Kariqo</b><small>Mentor portal</small></div></div>
        <div className="mentor-account"><span>{email}</span><button className="secondary" onClick={() => void logout()}><LogOut size={14} /> Sign out</button></div>
      </header>
      <main className="mentor-content">
        <section className="mentor-welcome">
          <small>TEACH · CONNECT · GROW</small>
          <h1>Welcome, {user}.</h1>
          <p>Create a class, save it as a draft, then publish it for Kariqo students.</p>
        </section>
        <Panel className="mentor-profile-editor">
          <div className="mentor-classes-heading"><div><h2>Student directory profile</h2><p>Add your real mentor details so students can find and request a session with you.</p></div><Users size={18} /></div>
          {profileLoading ? <p>Loading your mentor profile…</p> : <form className="mentor-class-form" onSubmit={(event) => void saveMentorProfile(event)}>
            <div className="mentor-form-row"><label>Name<input name="full_name" defaultValue={mentorProfile?.full_name || user} maxLength={120} required /></label><label>Role or specialty<input name="title" defaultValue={mentorProfile?.title || ''} placeholder="e.g. Senior Product Designer" maxLength={160} required /></label></div>
            <label>About you<textarea name="bio" rows={3} defaultValue={mentorProfile?.bio || ''} placeholder="Your experience and how you help learners" maxLength={1200} required /></label>
            <label>Expertise <small>Separate topics with commas</small><input name="expertise" defaultValue={(mentorProfile?.expertise || []).join(', ')} placeholder="e.g. UX design, portfolios, interviews" maxLength={400} required /></label>
            <label className="mentor-directory-publish"><input name="published" type="checkbox" defaultChecked={mentorProfile?.published ?? true} /> Show my profile in the student mentor list</label>
            <button className="primary" disabled={busy}>{busy ? 'Saving…' : mentorProfile ? 'Save mentor profile' : 'Publish mentor profile'} <ArrowRight size={15} /></button>
          </form>}
          {mentorProfile && <small className="mentor-directory-status">Directory status: {mentorProfile.published ? 'Visible to students' : 'Hidden'}</small>}
        </Panel>
        <Panel className="mentor-question-inbox">
          <div className="mentor-classes-heading"><div><h2>Student doubt messages</h2><p>Reply here when a student can’t connect for a live session.</p></div><MessageSquareText size={18} /></div>
          {mentorQuestions.length ? <div className="mentor-question-list">{mentorQuestions.map((question) => <button className="mentor-question-row" key={question.id} onClick={() => setActiveQuestion(question)}><span className="mentor-question-avatar">{String(question.student_name).split(' ').map((part: string) => part[0]).slice(0, 2).join('')}</span><span><b>{question.student_name} · {question.subject || 'Doubt'}</b><small>{question.latest_message}</small></span><small>{new Date(question.latest_at).toLocaleDateString()}</small><MessageCircle size={15} /></button>)}</div> : <p className="mentor-attendance-empty">Student questions will show up here. You can reply in a private thread.</p>}
        </Panel>
        <div className="mentor-attendance-summary">
          <Panel><small>YOUR CLASSES</small><b>{classes.length}</b><span>Draft and published</span></Panel>
          <Panel><small>STUDENT SIGN-UPS</small><b>{attendanceRows.length}</b><span>Across all your classes</span></Panel>
          <Panel><small>ATTENDED</small><b>{attendanceRows.filter((row) => ['present', 'late'].includes(row.attendance_status)).length}</b><span>Marked present or late</span></Panel>
        </div>
        <Panel className="mentor-skill-gap-panel"><div className="mentor-classes-heading"><div><h2>Student skill gaps</h2><p>Skills under 60% across students registered in your classes.</p></div><Activity size={18} /></div>
          {attendanceRows.length ? <div className="mentor-gap-list">{[...new Set(attendanceRows.map((row) => row.user_id))].map((studentId) => {
            const student = attendanceRows.find((row) => row.user_id === studentId);
            const gaps = studentSkillRows.filter((skill) => skill.user_id === studentId && Number(skill.score) < 60).sort((a, b) => Number(a.score) - Number(b.score));
            return <div key={studentId}><b>{student?.student_name || 'Student'}</b><span>{gaps.length ? gaps.map((skill) => `${skill.name} (${skill.score}%)`).join(' · ') : 'No low-rated Skill DNA entries yet'}</span></div>;
          })}</div> : <p className="mentor-attendance-empty">Student skill gaps will appear after learners join one of your classes.</p>}
        </Panel>
        <div className="mentor-dashboard-grid">
          <Panel>
            <h2>Create a live class</h2>
            <p>Choose a title, date, and length. Drafts stay private until you publish them.</p>
            <form className="mentor-class-form" onSubmit={createClass}>
              <label>Class title<input name="title" placeholder="e.g. Intro to Data Analytics" required maxLength={120} /></label>
              <label>About this class<textarea name="description" rows={3} placeholder="What will students learn?" maxLength={1000} /></label>
              <label>External meeting link <small>Optional · leave blank to use Kariqo’s in-app video room</small><input name="meeting_url" type="url" placeholder="https://meet.google.com/..." maxLength={2048} /></label>
              <div className="mentor-form-row">
                <label>Start date and time<input name="starts_at" type="datetime-local" required /></label>
                <label>Duration<select name="duration_minutes" defaultValue="60"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label>
              </div>
              <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save class draft'} <ArrowRight size={15} /></button>
            </form>
          </Panel>
          <Panel>
            <div className="mentor-classes-heading"><div><h2>Your classes</h2><p>Publish a class when its details are ready.</p></div><span>{classes.length}</span></div>
            {loading ? <p>Loading your classes…</p> : classes.length ? <div className="mentor-class-list">{classes.map((item) => (
              <article className="mentor-class-item" key={item.id}>
                <small>{new Date(item.starts_at).toLocaleString()} · {item.duration_minutes} min</small>
                <h3>{item.title}</h3>
                <p>{item.description || 'No class description yet.'}</p>
                <form className="mentor-meeting-link-form" onSubmit={(event) => void saveMeetingLink(event, item)}>
                  <label>External meeting link<input name="meeting_url" type="url" defaultValue={item.meeting_url || ''} placeholder="Leave blank for Kariqo in-app room" maxLength={2048} /></label>
                  <button className="secondary" disabled={busy}>{busy ? 'Saving…' : item.meeting_url ? 'Update link' : 'Choose link'}</button>
                </form>
                {item.published && (isSafeMeetingUrl(item.meeting_url)
                  ? <a className="secondary mentor-start-class" href={item.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={13} /> Open meeting</a>
                  : <button className="primary mentor-start-class" onClick={() => setActiveRoom({ id: item.id, title: item.title })}><Video size={13} /> Start in-app class</button>)}
                <div><span className={item.published ? 'mentor-status live' : 'mentor-status'}>{item.published ? 'Published' : 'Draft'}</span><button className="secondary" onClick={() => void publishClass(item)}>{item.published ? 'Unpublish' : 'Publish'}</button></div>
                <details className="mentor-attendance-details">
                  <summary>{(() => { const roster = attendanceRows.filter((row) => row.class_id === item.id); const attended = roster.filter((row) => ['present', 'late'].includes(row.attendance_status)).length; const marked = roster.filter((row) => ['present', 'late', 'absent'].includes(row.attendance_status)).length; return `Attendance · ${roster.length} registered · ${attended} attended · ${marked ? Math.round(attended / marked * 100) : 0}% rate`; })()}</summary>
                  {attendanceRows.filter((row) => row.class_id === item.id).length ? <div className="mentor-attendance-list">{attendanceRows.filter((row) => row.class_id === item.id).map((row) => <div className="mentor-attendance-row" key={row.user_id}><span><b>{row.student_name}</b><small>{new Date(row.created_at).toLocaleDateString()}</small></span><select aria-label={`Attendance for ${row.student_name}`} value={row.attendance_status || 'not_marked'} disabled={busy || new Date(item.starts_at).getTime() > Date.now()} onChange={(event) => void markAttendance(row, event.target.value)}><option value="not_marked">Not marked</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></div>)}</div> : <p className="mentor-attendance-empty">No student registrations yet.</p>}
                  {new Date(item.starts_at).getTime() > Date.now() && <small className="mentor-attendance-hint">Attendance can be marked after the class starts.</small>}
                </details>
                <details className="mentor-learning-tools">
                  <summary>Class materials & assignments</summary>
                  <section className="mentor-class-recap-editor">
                    <div><h4>After-class notes & recording</h4><small>Publish a recap; registered students can see it after class ends.</small></div>
                    <form onSubmit={(event) => void saveClassNotes(event, item.id)}>
                      <textarea name="notes" rows={4} maxLength={12000} defaultValue={classNotes.find((note) => note.class_id === item.id)?.notes || ''} placeholder="Key topics, examples, homework, and follow-up pointers" />
                      <input name="recording_url" type="url" maxLength={2048} defaultValue={classNotes.find((note) => note.class_id === item.id)?.recording_url || ''} placeholder="Optional recording link (https://...)" />
                      <label><input name="published" type="checkbox" defaultChecked={classNotes.find((note) => note.class_id === item.id)?.published ?? false} /> Publish recap after the class</label>
                      <button className="secondary" disabled={busy}>{busy ? 'Saving…' : 'Save class recap'}</button>
                    </form>
                  </section>
                  <div className="mentor-tools-columns">
                    <section><h4>Materials</h4>
                      <form onSubmit={(event) => void addMaterial(event, item.id)} className="mentor-inline-form">
                        <input name="title" placeholder="Material title" required maxLength={160} />
                        <input name="url" type="url" placeholder="https:// resource link (optional if uploading file)" maxLength={2048} />
                        <label className="mentor-file-label">Or upload file (max 15 MB)<input name="material_file" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp" /></label>
                        <select name="resource_type" defaultValue="link"><option value="link">Link</option><option value="slides">Slides</option><option value="video">Video</option><option value="reading">Reading</option><option value="recording">Recording</option></select>
                        <button className="secondary" disabled={busy}>Add material</button>
                      </form>
                      {classMaterials.filter((material) => material.class_id === item.id).map((material) => <div className="mentor-resource-row" key={material.id}><a className="mentor-resource-link" href={material.access_url || undefined} target="_blank" rel="noreferrer"><FileText size={13} />{material.title}<small>{material.storage_path ? 'uploaded file' : material.resource_type}</small></a><button className="mentor-remove-material" onClick={() => void removeMaterial(material)} disabled={busy} aria-label={`Remove ${material.title}`}><Trash2 size={12} /></button></div>)}
                      {!classMaterials.some((material) => material.class_id === item.id) && <small className="mentor-tool-empty">No materials added yet.</small>}
                    </section>
                    <section><h4>Assignments</h4>
                      <form onSubmit={(event) => void addAssignment(event, item.id)} className="mentor-inline-form">
                        <input name="title" placeholder="Assignment title" required maxLength={160} />
                        <textarea name="instructions" placeholder="Instructions / what to submit" rows={2} maxLength={4000} />
                        <label className="mentor-due-label">Due date <input name="due_at" type="datetime-local" /></label>
                        <button className="secondary" disabled={busy}>Create assignment</button>
                      </form>
                      {classAssignments.filter((assignment) => assignment.class_id === item.id).map((assignment) => <article className="mentor-assignment-review" key={assignment.id}>
                        <b>{assignment.title}</b><small>{assignment.due_at ? `Due ${new Date(assignment.due_at).toLocaleString()}` : 'No due date'}</small><p>{assignment.instructions}</p>
                        {assignmentSubmissions.filter((submission) => submission.assignment_id === assignment.id).map((submission) => <form className="mentor-submission-card" key={submission.id} onSubmit={(event) => void reviewSubmission(event, submission.id)}>
                          <strong>{submission.student_name}</strong><small>Submitted {new Date(submission.submitted_at).toLocaleString()}</small>
                          {submission.submission_text && <p>{submission.submission_text}</p>}
                          {submission.submission_url && <a href={submission.submission_url} target="_blank" rel="noreferrer">Open student work</a>}
                          <div className="mentor-review-fields"><label>Score %<input name="score" type="number" min="0" max="100" step="0.5" defaultValue={submission.score ?? ''} /></label><label>Feedback<textarea name="feedback" rows={2} maxLength={4000} defaultValue={submission.feedback || ''} placeholder="What went well, and what to improve?" /></label></div>
                          <button className="primary" disabled={busy}>Save feedback</button>
                        </form>)}
                        {!assignmentSubmissions.some((submission) => submission.assignment_id === assignment.id) && <small className="mentor-tool-empty">No submissions yet.</small>}
                      </article>)}
                      {!classAssignments.some((assignment) => assignment.class_id === item.id) && <small className="mentor-tool-empty">No assignments yet.</small>}
                    </section>
                  </div>
                </details>
              </article>
            ))}</div> : <div className="mentor-empty"><CalendarDays /><h3>No classes yet</h3><p>Your saved classes will show up here.</p></div>}
          </Panel>
        </div>
      </main>
      {activeRoom && <LiveClassRoom roomId={activeRoom.id} title={activeRoom.title} displayName={user} isHost onClose={() => setActiveRoom(null)} />}
      {activeQuestion && mentorProfile && <MentorChatDialog mentor={mentorProfile} studentId={activeQuestion.student_id} studentName={activeQuestion.student_name} initialThread={activeQuestion} viewerIsMentor onClose={() => setActiveQuestion(null)} say={say} />}
      {toast && <div className={`toast ${toast.type}`}><Check size={15} /> {toast.msg}</div>}
    </div>
  );
}

type OwnerOverview = {
  totalUsers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  paymentSetup: { ready: boolean; missing: string[] };
  companyPaymentSetup?: { ready: boolean; missing: string[] };
  subscriptions: { userId: string; name: string; email: string; status: string; currentEnd: string | null; updatedAt: string; providerSubscriptionId: string }[];
  companyRequests: { id: string; userId: string; companyName: string; contactName: string; email: string; status: string; createdAt: string }[];
  supportRequests: { id: string; userId: string; name: string; email: string; topic: string; body: string; status: 'open' | 'in_progress' | 'resolved'; staffReply: string; staffRepliedAt: string | null; createdAt: string; updatedAt: string }[];
};

function OwnerDashboard({ user, ownerProfile, email, logout, say, toast }: { user: string; ownerProfile: Record<string, any>; email: string; logout: () => Promise<void>; say: (s: string, type?: ToastState['type']) => void; toast: ToastState | null }) {
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reviewingRequest, setReviewingRequest] = useState('');
  const [savingSupportId, setSavingSupportId] = useState('');
  const [supportDrafts, setSupportDrafts] = useState<Record<string, { status: 'open' | 'in_progress' | 'resolved'; staffReply: string }>>({});

  const load = async () => {
    if (!supabase) {
      setLoadError('Kariqo is not connected to Supabase in this app build.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase.functions.invoke('owner-dashboard', { body: {} });
      if (error) {
        let detail = dbMessage(error, 'Owner dashboard request failed');
        const response = (error as { context?: unknown }).context;
        if (response instanceof Response) {
          try {
            const body = await response.clone().json();
            if (typeof body?.error === 'string') detail = body.error;
          } catch { /* Keep the Supabase function error text. */ }
        }
        throw new Error(detail);
      }
      if (!data || typeof data.totalUsers !== 'number' || !Array.isArray(data.subscriptions)) {
        throw new Error(data?.error || 'The Edge Function returned an empty or unexpected response. Check its deployed version.');
      }
      setOverview(data as OwnerOverview);
    } catch (error) {
      const detail = dbMessage(error, 'Could not load owner dashboard');
      setOverview(null);
      setLoadError(detail);
      say(detail, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const reviewCompanyRequest = async (requestId: string, decision: 'approve' | 'reject') => {
    if (!supabase) return;
    setReviewingRequest(requestId);
    try {
      const { data, error } = await supabase.functions.invoke('owner-dashboard', { body: { action: 'review-company-request', requestId, decision } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not review company request'));
      if (data?.error) throw new Error(data.error);
      say(decision === 'approve' ? 'Company account approved. They can sign in to the company portal.' : 'Company access request rejected.', 'success');
      await load();
    } catch (error) {
      say(dbMessage(error, 'Could not review company request'), 'error');
    } finally {
      setReviewingRequest('');
    }
  };

  const saveSupportRequest = async (request: OwnerOverview['supportRequests'][number]) => {
    if (!supabase) return;
    const draft = supportDrafts[request.id] || { status: request.status, staffReply: request.staffReply || '' };
    setSavingSupportId(request.id);
    try {
      const { data, error } = await supabase.functions.invoke('owner-dashboard', { body: {
        action: 'update-support-request', requestId: request.id, status: draft.status, staffReply: draft.staffReply,
      } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not save customer care update'));
      if (data?.error) throw new Error(data.error);
      say('Complaint status and reply saved.', 'success');
      await load();
    } catch (error) {
      say(dbMessage(error, 'Could not update customer care request'), 'error');
    } finally {
      setSavingSupportId('');
    }
  };
  const supportRequests = overview?.supportRequests || [];

  return (
    <div className="owner-portal">
      <header className="owner-topbar">
        <div className="brand"><div className="brand-mark"><Sparkles /></div><div><b>Kariqo</b><small>by <strong>Brain Strom</strong></small></div></div>
        <div className="owner-account"><span>{email}</span><button className="secondary" onClick={() => void logout()}><LogOut size={14} /> Sign out</button></div>
      </header>
      <main className="owner-content">
        <section className="owner-welcome"><div><small>OWNER MANAGEMENT</small><h1>App overview</h1><p>Review Kariqo accounts, subscription access, and payment setup.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button></section>
        <section className="owner-profile-card"><span className="company-access-icon"><ShieldCheck size={20} /></span><div><small>OWNER PROFILE</small><h2>{ownerProfile?.full_name || user || 'Kariqo owner'}</h2><p>{email}</p></div><span className="owner-status active">Owner access</span></section>
        {toast && <div className={`owner-toast ${toast.type}`}>{toast.msg}</div>}
        {loading ? <div className="owner-loading"><Loader2 className="spin" /> Loading management data…</div> : overview ? <>
          <div className="owner-stats">
            <article><Users size={17} /><small>Registered accounts</small><b>{overview.totalUsers}</b></article>
            <article><CreditCard size={17} /><small>Subscription records</small><b>{overview.totalSubscriptions}</b></article>
            <article><ShieldCheck size={17} /><small>Active subscriptions</small><b>{overview.activeSubscriptions}</b></article>
          </div>
          <section className={`owner-payment ${overview.paymentSetup.ready && overview.companyPaymentSetup?.ready ? 'ready' : 'needs-setup'}`}>
            <div><small>RAZORPAY PAYMENT SETUP</small><h2>{overview.paymentSetup.ready && overview.companyPaymentSetup?.ready ? 'Both subscription plans are configured' : 'Checkout setup still needs attention'}</h2>
              <p><b>Student plan · ₹199/month:</b> {overview.paymentSetup.ready ? 'Ready' : `Missing ${overview.paymentSetup.missing.join(', ') || 'payment settings'}`}<br />
                <b>Company Pro · ₹2,499/month:</b> {overview.companyPaymentSetup ? overview.companyPaymentSetup.ready ? 'Ready' : `Missing ${overview.companyPaymentSetup.missing.join(', ') || 'payment settings'}` : 'Deploy the updated owner-dashboard function to check this plan.'}<br />
                Razorpay account activation/KYC and Test Mode verification are required before enabling live payments.</p></div>
            <a className="secondary" href="https://dashboard.razorpay.com/" target="_blank" rel="noreferrer">Open Razorpay</a>
          </section>
          <section className="owner-subscriptions"><div className="owner-section-title"><div><h2>Company access requests</h2><p>Review employer registrations before their workspace can access opted-in candidate information.</p></div></div>
            {!overview.companyRequests?.length ? <div className="owner-empty">No company access requests yet.</div> : <div className="owner-table-wrap"><table><thead><tr><th>Company</th><th>Contact</th><th>Status</th><th>Requested</th><th>Review</th></tr></thead><tbody>{overview.companyRequests.map((request) => <tr key={request.id}><td><b>{request.companyName}</b></td><td>{request.contactName || 'Company contact'}<small>{request.email || request.userId}</small></td><td><span className={`owner-status ${request.status}`}>{request.status}</span></td><td>{new Date(request.createdAt).toLocaleDateString()}</td><td>{request.status === 'pending' ? <div className="owner-review-actions"><button className="primary" onClick={() => void reviewCompanyRequest(request.id, 'approve')} disabled={Boolean(reviewingRequest)}>{reviewingRequest === request.id ? 'Saving…' : 'Approve'}</button><button className="secondary" onClick={() => void reviewCompanyRequest(request.id, 'reject')} disabled={Boolean(reviewingRequest)}>Reject</button></div> : 'Reviewed'}</td></tr>)}</tbody></table></div>}
          </section>
          <section className="owner-subscriptions owner-support-inbox"><div className="owner-section-title"><div><h2>Customer care inbox</h2><p>{supportRequests.filter((request) => request.status !== 'resolved').length} open requests · Students can see your status and reply in their request history.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={13} /> Refresh</button></div>
            {!supportRequests.length ? <div className="owner-empty">No student complaints or support requests yet.</div> : <div className="owner-support-list">{supportRequests.map((request) => {
              const draft = supportDrafts[request.id] || { status: request.status, staffReply: request.staffReply || '' };
              return <article className="owner-support-ticket" key={request.id}>
                <header><div><b>{request.topic}</b><small>{request.name || 'Kariqo student'} · {request.email || request.userId} · {new Date(request.createdAt).toLocaleString()}</small></div><span className={`owner-status ${request.status}`}>{request.status.replace('_', ' ')}</span></header>
                <p className="owner-support-body">{request.body}</p>
                <div className="owner-support-controls"><label>Status<select value={draft.status} onChange={(event) => setSupportDrafts((current) => ({ ...current, [request.id]: { ...draft, status: event.target.value as 'open' | 'in_progress' | 'resolved' } }))}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label><label className="owner-support-reply">Reply to student<textarea value={draft.staffReply} maxLength={5000} rows={3} placeholder="Write a helpful reply the student can see…" onChange={(event) => setSupportDrafts((current) => ({ ...current, [request.id]: { ...draft, staffReply: event.target.value } }))} /></label></div>
                <footer><small>{request.staffRepliedAt ? `Last reply ${new Date(request.staffRepliedAt).toLocaleString()}` : 'No team reply sent yet'}</small><button className="primary" onClick={() => void saveSupportRequest(request)} disabled={Boolean(savingSupportId)}>{savingSupportId === request.id ? 'Saving…' : 'Save update'}</button></footer>
              </article>;
            })}</div>}
          </section>
          <section className="owner-subscriptions"><div className="owner-section-title"><div><h2>Subscriptions</h2><p>Payment status synced from Razorpay.</p></div></div>
            {!overview.subscriptions.length ? <div className="owner-empty">No subscription records yet. Checkout must be configured before students can subscribe.</div> : <div className="owner-table-wrap"><table><thead><tr><th>Account</th><th>Status</th><th>Access through</th><th>Updated</th><th>Razorpay ID</th></tr></thead><tbody>{overview.subscriptions.map((item) => <tr key={item.providerSubscriptionId}><td><b>{item.name || 'Kariqo user'}</b><small>{item.email || item.userId}</small></td><td><span className={`owner-status ${item.status}`}>{item.status}</span></td><td>{item.currentEnd ? new Date(item.currentEnd).toLocaleDateString() : '—'}</td><td>{new Date(item.updatedAt).toLocaleDateString()}</td><td><code>{item.providerSubscriptionId}</code></td></tr>)}</tbody></table></div>}
          </section>
        </> : <div className="owner-empty"><AlertCircle size={18} /><h3>The owner dashboard could not load.</h3><p>{loadError || 'Refresh the page and try again.'}</p><button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Try again</button></div>}
      </main>
    </div>
  );
}

type CompanyOverview = {
  company: { id: string; name: string };
  jobs: Record<string, any>[];
  offers: Record<string, any>[];
  candidates: Record<string, any>[];
  applications?: Record<string, any>[];
  plan?: { name: string; status: string; currentEnd: string | null; activeJobLimit: number };
};

function CompanyDashboard({ user, email, logout, say, toast }: {
  user: string;
  email: string;
  logout: () => Promise<void>;
  say: (message: string, type?: ToastState['type']) => void;
  toast: ToastState | null;
}) {
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [accessStatus, setAccessStatus] = useState('');
  const [requestedCompany, setRequestedCompany] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [billingBusy, setBillingBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiShortlist, setAiShortlist] = useState(false);

  const load = async (preferredJobId = '') => {
    if (!supabase) {
      setLoadError('Kariqo is not connected to Supabase in this app build.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const requestedJobId = preferredJobId || selectedJobId;
      const { data, error } = await supabase.functions.invoke('company-dashboard', {
        body: { action: 'load', ...(requestedJobId ? { jobId: requestedJobId } : {}) },
      });
      if (error) throw new Error(await functionErrorMessage(error, 'Company dashboard request failed'));
      if (data?.accessStatus) {
        setOverview(null);
        setAccessStatus(data.accessStatus);
        setRequestedCompany(data.requestedCompany || '');
        return;
      }
      if (!data?.company || !Array.isArray(data.jobs) || !Array.isArray(data.candidates)) {
        throw new Error(data?.error || 'The company Edge Function returned an empty or unexpected response.');
      }
      setAccessStatus('');
      setOverview(data as CompanyOverview);
      const nextJobId = requestedJobId || data.jobs[0]?.id || '';
      if (nextJobId && nextJobId !== selectedJobId) setSelectedJobId(nextJobId);
      if (nextJobId && nextJobId !== requestedJobId) {
        setLoading(false);
        await load(nextJobId);
        return;
      }
    } catch (error) {
      const detail = dbMessage(error, 'Could not load company dashboard');
      setOverview(null);
      setLoadError(detail);
      say(detail, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const createJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return say('Kariqo backend is not connected', 'error');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requiredSkills = String(form.get('required_skills') || '').split(',').map((skill) => skill.trim()).filter(Boolean);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: {
        action: 'create-job', title: form.get('title'), description: form.get('description'),
        requiredSkills, location: form.get('location'), jobType: form.get('job_type'),
      } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not publish this job'));
      if (data?.error) throw new Error(data.error);
      formElement.reset();
      say('Job requirement published. Finding eligible students…', 'success');
      await load(data?.jobId || '');
    } catch (error) {
      say(dbMessage(error, 'Could not publish this job'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const startCompanyPro = async () => {
    if (!supabase) return say('Kariqo backend is not connected', 'error');
    setBillingBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'create-subscription' } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not start company checkout'));
      if (data?.error) throw new Error(data.error);
      if (data?.active) { say('Pro hiring is already active for your company.', 'success'); await load(); return; }
      if (!data?.checkoutUrl) throw new Error('Razorpay did not return the secure checkout link.');
      const handler = (window as Window & { webkit?: { messageHandlers?: { openCheckout?: { postMessage: (url: string) => void } } } }).webkit?.messageHandlers?.openCheckout;
      if (handler) handler.postMessage(data.checkoutUrl);
      else window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
      say('Razorpay checkout opened. After payment, return here and refresh to unlock Pro.', 'info');
    } catch (error) {
      say(dbMessage(error, 'Could not start company checkout'), 'error');
    } finally {
      setBillingBusy(false);
    }
  };

  const sendOffer = async (studentId: string) => {
    if (!supabase || !selectedJobId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', {
        body: { action: 'send-offer', jobId: selectedJobId, studentId },
      });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not send the offer'));
      if (data?.error) throw new Error(data.error);
      say(data?.message || 'Job offer sent to the student', 'success');
      await load(selectedJobId);
    } catch (error) {
      say(dbMessage(error, 'Could not send the offer'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateApplicantStage = async (applicationId: string, status: string) => {
    if (!supabase) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'update-application', applicationId, status } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not update application stage'));
      if (data?.error) throw new Error(data.error);
      await load(selectedJobId);
      say('Applicant stage updated', 'success');
    } catch (error) { say(dbMessage(error, 'Could not update application stage'), 'error'); }
    finally { setBusy(false); }
  };

  const requestCompanyAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return say('Kariqo backend is not connected', 'error');
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'request-access', companyName: form.get('company_name') } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not submit company request'));
      if (data?.error) throw new Error(data.error);
      setAccessStatus(data?.accessStatus || 'pending');
      setRequestedCompany(data?.requestedCompany || String(form.get('company_name') || ''));
      say('Company access request submitted for review', 'success');
    } catch (error) {
      say(dbMessage(error, 'Could not submit company request'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectedJob = overview?.jobs.find((job) => job.id === selectedJobId);
  const runAiShortlist = async () => {
    if (!supabase || !selectedJobId) return say('Choose an open role first.', 'info');
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'ai-shortlist', jobId: selectedJobId } });
      if (error) throw new Error(await functionErrorMessage(error, 'AI shortlist could not run'));
      if (data?.error) throw new Error(data.error);
      setOverview(data as CompanyOverview);
      setAiShortlist(true);
      say('AI shortlist is ready. Review its evidence and make the hiring decision yourself.', 'success');
    } catch (error) { say(dbMessage(error, 'AI shortlist could not run'), 'error'); }
    finally { setAiBusy(false); }
  };
  return <div className="company-portal">
    <header className="company-topbar"><div className="brand"><div className="brand-mark"><Building2 /></div><div><b>Kariqo</b><small>Company portal · {overview?.company.name || 'Employer workspace'}</small></div></div><div className="company-account"><span>{user} · {email}</span><button className="secondary" onClick={() => void logout()}><LogOut size={14} /> Sign out</button></div></header>
    <main className="company-content">
      <section className="company-welcome"><div><small>HIRE THROUGH PROVEN SKILLS</small><h1>Find your next great hire.</h1><p>Post the skills you need. Kariqo shows candidates who completed their learning plan, finished a project, unlocked their ATS resume, and opted into employer sharing.</p></div><span className="company-hero-icon"><Building2 size={28} /></span></section>
      {toast && <div className={`owner-toast ${toast.type}`}>{toast.msg}</div>}
      {accessStatus && accessStatus !== 'approved' ? <Panel className="company-access-card">
        {accessStatus === 'pending' ? <><span className="company-access-icon"><Loader2 size={20} /></span><small>COMPANY REVIEW</small><h2>Request received</h2><p>{requestedCompany ? `${requestedCompany} is` : 'Your company is'} waiting for Kariqo management approval. The student matching workspace stays locked until access is approved.</p><button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Check request status</button></> : accessStatus === 'rejected' ? <><span className="company-access-icon"><AlertCircle size={20} /></span><small>COMPANY REVIEW</small><h2>Request needs attention</h2><p>Kariqo management could not approve this request. Contact the Kariqo team to update the company details.</p></> : <><span className="company-access-icon"><Building2 size={20} /></span><small>COMPANY REGISTRATION</small><h2>Request company access</h2><p>Tell us your company name. Kariqo management will review the request before the recruiter workspace can view any student who opted into sharing.</p><form className="company-job-form" onSubmit={requestCompanyAccess}><label>Company name<input name="company_name" placeholder="Registered company name" minLength={2} maxLength={120} required /></label><button className="primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'} <ArrowRight size={15} /></button></form></>}
      </Panel> : <div className="company-grid">
        <Panel className="company-plans-panel">
          <div className="company-section-head"><div><h2>Grow your hiring with Kariqo</h2><p>Start free, then add visibility and sourcing tools when you need them.</p></div><Sparkles size={18} /></div>
          <div className="company-plans-grid">
            <article className="company-plan-card"><small>STARTER</small><h3>Free</h3><p className="company-plan-price">₹0 <span>/ always</span></p><ul><li>1 active job post</li><li>Skill matched candidates</li><li>Send offers to opted-in students</li></ul><button className="secondary" onClick={() => say('Starter is available now. Post a role below to begin.', 'info')}>Current access</button></article>
            <article className="company-plan-card featured"><small>GROWTH · MONTHLY</small><h3>Pro hiring</h3><p className="company-plan-price">₹2,499 <span>/ month</span></p><ul><li>Up to 5 active job posts</li><li>Candidate filters and shortlists</li><li>Priority support</li></ul><button className="primary" onClick={() => { setSelectedPlan('Pro hiring'); void startCompanyPro(); }} disabled={billingBusy || overview?.plan?.name === 'Pro hiring'}>{billingBusy ? 'Opening checkout…' : overview?.plan?.name === 'Pro hiring' ? 'Pro active' : 'Subscribe to Pro'}</button></article>
            <article className="company-plan-card"><small>ONE-TIME VISIBILITY</small><h3>Featured role</h3><p className="company-plan-price">₹499 <span>/ post · proposed</span></p><ul><li>Highlight one job post</li><li>Priority placement in opportunities</li><li>7-day feature window</li></ul><button className="secondary" onClick={() => { setSelectedPlan('Featured role'); say('Featured role interest noted. Online company checkout is not configured yet; ask the Kariqo owner to activate this pilot option.', 'info'); }}>Request feature</button></article>
          </div>
          <p className="company-plan-note">Secure recurring checkout is handled by Razorpay. Pro raises the active job limit from 1 to 5 after payment is confirmed.</p>
          {selectedPlan && billingBusy && <span className="company-plan-selection">Preparing {selectedPlan} checkout…</span>}
        </Panel>
        <Panel><div className="company-section-head"><div><h2>Post a role</h2><p>Tell students exactly which skills your team needs.</p></div><BriefcaseBusiness size={18} /></div>
          <form className="company-job-form" onSubmit={createJob}>
            <label>Job title<input name="title" placeholder="e.g. Junior Frontend Developer" minLength={3} maxLength={120} required /></label>
            <label>Required skills<input name="required_skills" placeholder="React, TypeScript, CSS" required /><small>Separate skills with commas. Matches are based on student skill names.</small></label>
            <div className="company-form-row"><label>Location<input name="location" placeholder="Chennai · Hybrid" /></label><label>Type<select name="job_type" defaultValue="Full-time"><option>Full-time</option><option>Internship</option><option>Part-time</option><option>Contract</option></select></label></div>
            <label>Role details<textarea name="description" rows={3} maxLength={4000} placeholder="What will the selected student work on?" /></label>
            <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Publish job requirement'} <ArrowRight size={15} /></button>
          </form>
        </Panel>
        <Panel className="company-candidate-panel"><div className="company-section-head"><div><h2>{aiShortlist ? 'AI-ranked candidates' : 'Matched students'}</h2><p>Only interview-ready students who chose to share their resume appear here. AI ranking is advisory and evidence-based.</p></div><div className="company-action-row"><button className="primary" onClick={() => void runAiShortlist()} disabled={loading || aiBusy || !selectedJobId}>{aiBusy ? 'AI reviewing…' : <><Sparkles size={13} /> AI shortlist</>}</button><button className="secondary" onClick={() => { setAiShortlist(false); void load(selectedJobId); }} disabled={loading}><RefreshCw size={14} /></button></div></div>
          {overview?.jobs.length ? <div className="company-job-tabs">{overview.jobs.map((job) => <button key={job.id} className={job.id === selectedJobId ? 'selected' : ''} onClick={() => void load(job.id)}>{job.title}<small>{job.status}</small></button>)}</div> : null}
          {overview?.applications?.length ? <div className="company-applicants"><h3>Applications from students</h3>{overview.applications.map((application) => <article key={application.id}><div><b>{application.student?.full_name || 'Student'}</b><small>{application.student?.course || 'Kariqo learner'}{application.student?.college ? ` · ${application.student.college}` : ''} · Applied {new Date(application.created_at).toLocaleDateString()}</small></div><select aria-label={`Application stage for ${application.student?.full_name || 'student'}`} value={application.status} disabled={busy} onChange={(event) => void updateApplicantStage(application.id, event.target.value)}><option value="applied">Applied</option><option value="screening">Screening</option><option value="interview">Interview</option><option value="rejected">Not selected</option></select></article>)}</div> : null}
          {loading ? <div className="owner-loading"><Loader2 className="spin" /> Loading matched students…</div> : loadError ? <div className="owner-empty"><AlertCircle size={18} /><h3>Company dashboard could not load</h3><p>{loadError}</p><button className="secondary" onClick={() => void load()}><RefreshCw size={14} /> Try again</button></div> : !selectedJob ? <div className="owner-empty"><BriefcaseBusiness /><h3>Post your first role</h3><p>Add a job requirement and its required skills to find matching students.</p></div> : overview?.candidates.length ? <div className="company-candidate-list">{overview.candidates.map((candidate) => <article className="company-candidate" key={candidate.id}><div className="company-candidate-heading"><div><small>{candidate.course || 'Kariqo student'}{candidate.college ? ` · ${candidate.college}` : ''}</small><h3>{candidate.name || 'Interview-ready candidate'}</h3><p>{candidate.careerGoal || selectedJob.title}</p></div><strong>{candidate.matchScore}%<small>SKILL MATCH</small></strong></div><p className="candidate-readiness-score">Career readiness · <b>{candidate.readinessScore}/100</b></p><div className="chips">{candidate.skills.map((skill: { name: string; score: number }) => <span className="chip" key={skill.name}>{skill.name} · {skill.score}%</span>)}</div><p className="candidate-projects"><b>Completed projects:</b> {candidate.projects.map((project: { title: string }) => project.title).join(' · ')}</p>{candidate.aiReason && <div className="company-ai-reason"><Sparkles size={13} /><div><b>Why this match</b><p>{candidate.aiReason}</p>{candidate.aiGaps?.length > 0 && <small>Gaps to discuss: {candidate.aiGaps.join(' · ')}</small>}</div></div>}<details><summary><FileText size={14} /> View shared ATS resume</summary><pre>{candidate.resume}</pre></details><button className="primary" onClick={() => void sendOffer(candidate.id)} disabled={busy || Boolean(candidate.existingOffer)}><Send size={14} />{candidate.existingOffer ? 'Offer already sent' : 'Send job offer'}</button></article>)}</div> : <div className="owner-empty"><Users /><h3>No matches for this role yet</h3><p>Matching starts at 50% skill match. Students must reach 70 readiness points, complete their roadmap and one project, confirm interview readiness, and opt into sharing.</p></div>}
        </Panel>
        {overview && <CompanySimulationManager jobs={overview.jobs} say={say} />}
      </div>}
      {overview && <div className="company-privacy-note"><ShieldCheck size={16} /><p>Candidate details are shared only after each student explicitly opts in. Their profile disappears from search when they turn sharing off or revoke interview readiness.</p></div>}
    </main>
  </div>
}

function CompanySimulationManager({ jobs, say }: { jobs: Record<string, any>[]; say: (message: string, type?: ToastState['type']) => void }) {
  const [simulations, setSimulations] = useState<Record<string, any>[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedJob, setSelectedJob] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'list-simulations' } });
    if (error) return say(await functionErrorMessage(error, 'Could not load company simulations'), 'error');
    if (data?.error) return say(data.error, 'error');
    setSimulations(data?.simulations || []);
    setSubmissions(data?.submissions || []);
  };
  useEffect(() => { if (!selectedJob && jobs[0]?.id) setSelectedJob(jobs[0].id); }, [jobs, selectedJob]);
  useEffect(() => { void load(); }, []);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'create-simulation', jobId: selectedJob, title: form.get('simulation_title'), instructions: form.get('simulation_instructions'), requiredSkills: String(form.get('simulation_skills') || '').split(',').map((skill) => skill.trim()).filter(Boolean), deadline: form.get('simulation_deadline') || undefined } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not publish work simulation'));
      if (data?.error) throw new Error(data.error);
      event.currentTarget.reset();
      say('Company work simulation published for students.', 'success');
      await load();
    } catch (error) { say(dbMessage(error, 'Could not publish work simulation'), 'error'); }
    finally { setBusy(false); }
  };
  const review = async (submission: Record<string, any>, status: string) => {
    if (!supabase) return;
    const draft = drafts[submission.id] || { score: '', feedback: '' };
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'review-simulation', submissionId: submission.id, status, score: draft.score ? Number(draft.score) : undefined, feedback: draft.feedback } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not review simulation'));
      if (data?.error) throw new Error(data.error);
      say(data?.message || 'Review saved', 'success');
      await load();
    } catch (error) { say(dbMessage(error, 'Could not review simulation'), 'error'); }
    finally { setBusy(false); }
  };
  return <Panel className="company-simulation-panel"><div className="company-section-head"><div><h2>Work simulations</h2><p>Post a small role task, review real submissions, and shortlist based on demonstrated work.</p></div><Target size={18} /></div>
    {jobs.filter((job) => job.status === 'open').length ? <form className="company-job-form" onSubmit={create}>
      <label>Role<select value={selectedJob} onChange={(event) => setSelectedJob(event.target.value)} required>{jobs.filter((job) => job.status === 'open').map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
      <label>Task title<input name="simulation_title" placeholder="e.g. Find three insights in this sales data" minLength={3} maxLength={160} required /></label>
      <label>Task instructions<textarea name="simulation_instructions" rows={3} minLength={20} maxLength={6000} placeholder="Describe the sample task, expected deliverable, and what a good submission demonstrates." required /></label>
      <label>Skills to demonstrate<input name="simulation_skills" placeholder="SQL, data storytelling" /><small>Separate skills with commas.</small></label>
      <label>Submission deadline (optional)<input name="simulation_deadline" type="datetime-local" /></label>
      <button className="primary" disabled={busy || !selectedJob}>{busy ? 'Publishing…' : 'Publish company challenge'} <ArrowRight size={14} /></button>
    </form> : <div className="owner-empty"><p>Publish a role before creating its matching work simulation.</p></div>}
    {!simulations.length ? <p className="company-simulation-empty">No simulations posted yet. Students will see published tasks in Opportunities.</p> : <div className="company-simulations-list">{simulations.map((simulation) => <article className="company-simulation-card" key={simulation.id}><small>{jobs.find((job) => job.id === simulation.job_id)?.title || 'Role'} · {simulation.status}</small><h3>{simulation.title}</h3><p>{simulation.instructions}</p><div className="tags">{(simulation.expected_skills || []).map((skill: string) => <i key={skill}>{skill}</i>)}</div>{submissions.filter((submission) => submission.simulation_id === simulation.id).map((submission) => { const draft = drafts[submission.id] || { score: String(submission.score ?? ''), feedback: submission.feedback || '' }; return <div className="company-simulation-submission" key={submission.id}><small>{submission.student?.full_name || 'Opted-in student'} · {new Date(submission.submitted_at).toLocaleDateString()} · {submission.status}</small>{submission.student?.course && <small>{submission.student.course}{submission.student.college ? ` · ${submission.student.college}` : ''}</small>}<p>{submission.answer}</p>{submission.project_url && <a href={submission.project_url} target="_blank" rel="noreferrer">Open submitted evidence <ArrowRight size={12} /></a>}<div className="simulation-review-fields"><label>Score / 100<input type="number" min="0" max="100" value={draft.score} onChange={(event) => setDrafts((old) => ({ ...old, [submission.id]: { ...draft, score: event.target.value } }))} /></label><label>Feedback<input value={draft.feedback} maxLength={4000} onChange={(event) => setDrafts((old) => ({ ...old, [submission.id]: { ...draft, feedback: event.target.value } }))} placeholder="Strengths and next step" /></label></div><div className="company-simulation-actions"><button className="secondary" disabled={busy} onClick={() => void review(submission, 'reviewing')}>Mark reviewing</button><button className="secondary" disabled={busy} onClick={() => void review(submission, 'not_selected')}>Not selected</button><button className="primary" disabled={busy} onClick={() => void review(submission, 'shortlisted')}>Shortlist for interview</button></div></div>; })}</article>)}</div>}
    <small className="company-simulation-note">Only students who enabled employer sharing are identifiable to the company. Shortlisting is the company’s decision; submitting a task does not guarantee a job.</small>
  </Panel>;
}

function MembershipGate({ c, feature }: { c: Ctx; feature: 'mentor' | 'classes' }) {
  const label = feature === 'mentor' ? 'Mentor Connect' : 'Live Classes';
  return (
    <>
      <Head tag="KARIQO PLUS" title={`${label} subscription`} desc="An active membership is needed to view and book mentors or live classes." />
      <Panel className="membership-card">
        <div className="membership-emblem">
          <Sparkles />
        </div>
        <small>MENTOR + LIVE CLASS ACCESS</small>
        <h2>
          Learn with people.
          <br />
          <em>Grow with guidance.</em>
        </h2>
        <p>One subscription unlocks Mentor Connect and all published Live Classes in Kariqo.</p>
        <div className="membership-price">
          <b>₹199</b>
          <span>
            / month
            <br />
            <small>INR · billed monthly</small>
          </span>
        </div>
        <ul>
          <li>
            <Check size={15} /> Browse mentors and request sessions
          </li>
          <li>
            <Check size={15} /> View and register for live classes
          </li>
          <li>
            <Check size={15} /> Membership status verified with Razorpay
          </li>
        </ul>
        <div className="membership-actions">
          <button className="primary" onClick={c.subscribe} disabled={c.membershipBusy || c.membershipLoading}>
            {c.membershipBusy ? 'Checking…' : 'Subscribe for ₹199 / month'} <ArrowRight size={15} />
          </button>
          <button className="secondary" onClick={c.checkMembership} disabled={c.membershipBusy}>
            {c.membershipBusy ? 'Checking…' : 'I have paid — check access'}
          </button>
        </div>
        <small className="membership-note">
          Recurring monthly subscription for up to 100 billing cycles. Complete payment securely in Razorpay. You can manage cancellation from the
          Razorpay subscription page.
        </small>
      </Panel>
    </>
  );
}

function render(page: Page, c: Ctx) {
  const pages: Record<Page, () => ReactNode> = {
    Overview: () => <Overview c={c} />,
    'Skill DNA': () => <DNA c={c} />,
    'AI Roadmap': () => <Roadmap c={c} />,
    'Career Copilot': () => <CareerCopilot c={c} />,
    'Interview Practice': () => <InterviewPractice c={c} />,
    Projects: () => <Projects c={c} />,
    'Skill Passport': () => <Passport c={c} />,
    Opportunities: () => <Opportunities c={c} />,
    'Job Offers': () => <JobOffers c={c} />,
    Applications: () => <Applications c={c} />,
    Mentor: () => <Mentor c={c} />,
    'Live Classes': () => <Classes c={c} />,
    Notifications: () => <Notifications c={c} />,
    Announcements: () => <Announcements c={c} />,
    'Customer Care': () => <Support c={c} />,
    'Profile & Settings': () => <Profile c={c} />,
  };
  return pages[page]();
}

function Head({ tag, title, desc, action }: { tag: string; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <small>{tag}</small>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`panel ${className}`} style={style}>{children}</section>;
}

function Progress({ value, color = '' }: { value: number; color?: string }) {
  return (
    <div className="progress">
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

function readinessScore(records: Records) {
  const profile = records.profile;
  const profilePoints = ['full_name', 'course', 'college', 'career_goal', 'bio'].filter((key) => String(profile[key] || '').trim()).length * 3;
  const skillPoints = Math.min(20, records.skills.length * 4);
  const completed = records.projects.filter((project) => project.status === 'completed').length;
  const projectPoints = Math.min(25, completed * 15 + Math.min(10, records.projects.filter((project) => project.status !== 'completed' && Number(project.progress) > 0).length * 2));
  const practicePoints = Math.min(20, new Set(records.interviewSessions.map((session) => String(session.practice_date).slice(0, 10))).size * 5);
  const attendanceTotal = records.attendance.length;
  const attendanceRate = attendanceTotal ? records.attendance.filter((item) => ['present', 'late'].includes(item.attendance_status)).length / attendanceTotal : 0;
  const scores = records.assignmentScores.map((item) => Number(item.score)).filter(Number.isFinite);
  const learningPoints = Math.round((attendanceRate * 8) + (scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 0.07 : 0));
  return Math.min(100, profilePoints + skillPoints + projectPoints + practicePoints + learningPoints);
}

function Overview({ c }: { c: Ctx }) {
  const [proofBusy, setProofBusy] = useState(false);
  const completed = c.records.projects.filter((p) => p.status === 'completed').length;
  const practiceDays = new Set(c.records.interviewSessions.map((session) => String(session.practice_date).slice(0, 10)));
  const xp = practiceDays.size * 100;
  const streak = getPracticeStreak(practiceDays);
  const weakestSkill = [...c.records.skills].sort((a, b) => Number(a.score) - Number(b.score))[0];
  const proofSkill = String(weakestSkill?.name || '').trim();
  const careerGoal = String(c.records.profile.career_goal || c.goal || 'your target role').trim();
  const skillKey = proofSkill.toLowerCase();
  const proofDeliverable = skillKey.includes('sql') || skillKey.includes('database')
    ? 'Use a small real dataset to design related tables, write five useful queries, and explain one finding.'
    : skillKey.includes('react') || skillKey.includes('ui') || skillKey.includes('frontend')
      ? 'Build a responsive mini dashboard with a search or filter, a useful empty state, and a short README.'
      : skillKey.includes('python') || skillKey.includes('data')
        ? 'Clean a small public dataset, answer one real question, and share a chart with a short explanation.'
        : skillKey.includes('communication') || skillKey.includes('english')
          ? 'Prepare a two-minute STAR story about a real task, record a practice answer, and note one improvement.'
          : `Build a small ${proofSkill || 'role-relevant'} project for ${careerGoal}; show the problem, your approach, and the result in a short README.`;
  const startProofSprint = async () => {
    if (!proofSkill) return c.setPage('Skill DNA');
    if (!supabase || !c.userId) return c.say('Sign in to save your proof sprint', 'error');
    setProofBusy(true);
    try {
      const title = `1-Day Proof Sprint · ${proofSkill}`;
      const description = [
        `Target role: ${careerGoal}`,
        `Skill focus: ${proofSkill} · current self-rating ${Number(weakestSkill.score) || 0}%`,
        `Build: ${proofDeliverable}`,
        'Evidence checklist: include your own work, a short README, and one measurable result or learning.',
      ].join('\n');
      const { error } = await supabase.from('projects').insert({
        user_id: c.userId,
        title,
        description,
        status: 'in_progress',
        progress: 0,
      });
      if (error) throw error;
      await c.refresh();
      c.say('Proof Sprint added to Projects', 'success');
      c.setPage('Projects');
    } catch (error) {
      c.say(dbMessage(error, 'Could not add your Proof Sprint'), 'error');
    } finally {
      setProofBusy(false);
    }
  };
  return (
    <>
      <Head
        tag="YOUR WORKSPACE"
        title={'Welcome, ' + (c.user.split(' ')[0] || 'Student')}
        desc="Your progress and next steps, saved to your Kariqo account."
        action={
          <button className="primary" onClick={() => c.setPage('AI Roadmap')}>
            <Sparkles size={16} /> Open roadmap
          </button>
        }
      />
      <div className="metrics">
        {[
          ['Skills tracked', c.records.skills.length],
          ['Projects', c.records.projects.length],
          ['Completed', completed],
          ['Unread updates', c.notices.filter((n) => n.unread).length],
        ].map((x) => (
          <Panel key={x[0] as string} className="metric">
            <span>{x[0]}</span>
            <b>{x[1]}</b>
          </Panel>
        ))}
      </div>
      <Panel className="skillvo-quest-card">
        <div className="skillvo-quest-copy"><small>KARIQO DAILY QUEST</small><h2>Practice one interview answer today.</h2><p>Use your roadmap skills and project evidence. Save a daily drill to earn 100 XP and build your interview streak.</p><button className="primary" onClick={() => c.setPage('Interview Practice')}><MessageSquareText size={15} /> Open Interview Practice <ArrowRight size={14} /></button></div>
        <div className="skillvo-quest-stats"><div><Flame size={18} /><b>{streak}</b><small>day streak</small></div><div><Trophy size={18} /><b>{xp}</b><small>XP · Level {Math.floor(xp / 300) + 1}</small></div></div>
      </Panel>
      <Panel className="proof-sprint-card">
        <div className="proof-sprint-icon"><Sparkles size={18} /></div>
        <div className="proof-sprint-main">
          <small>GAP → PROOF · ONE-DAY MICRO-SPRINT</small>
          <h2>{proofSkill ? `Make ${proofSkill} your next proof point` : 'Turn one skill into proof'}</h2>
          <p>{proofSkill ? `Picked from your lowest self-rated Skill DNA skill for ${careerGoal}.` : 'Add a skill to your Skill DNA and Kariqo will suggest a small, role-focused project.'}</p>
        </div>
        <div className="proof-sprint-deliverable">
          <small>YOUR CHALLENGE</small>
          <p>{proofDeliverable}</p>
        </div>
        <button className="secondary" onClick={() => void startProofSprint()} disabled={proofBusy}>
          {proofBusy ? 'Saving…' : proofSkill ? 'Add to Projects' : 'Add a skill first'} <ArrowRight size={14} />
        </button>
      </Panel>
      <div className="two-col">
        <Panel>
          <div className="panel-head">
            <div>
              <h3>Your Skill DNA</h3>
              <p>Skills you have added to your profile.</p>
            </div>
            <button onClick={() => c.setPage('Skill DNA')}>
              Manage skills <ArrowRight size={14} />
            </button>
          </div>
          {c.records.skills.length ? (
            c.records.skills.map((k) => (
              <div className="skill-label" key={k.id}>
                <span>{k.name}</span>
                <b>{k.score}%</b>
              </div>
            ))
          ) : (
            <p>Add your first skill to start building your profile.</p>
          )}
        </Panel>
        <Panel>
          <div className="panel-head">
            <div>
              <h3>Your projects</h3>
              <p>Work saved in your account.</p>
            </div>
            <button onClick={() => c.setPage('Projects')}>
              Open projects <ArrowRight size={14} />
            </button>
          </div>
          {c.records.projects.length ? (
            c.records.projects.slice(0, 4).map((p) => (
              <div className="event" key={p.id}>
                <div>
                  <b>{p.title}</b>
                  <span>
                    {p.status} · {p.progress}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p>Your project list is empty.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

type PracticeQuestion = { id: string; category: string; prompt: string; sample: string };
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function getPracticeStreak(dates: Set<string>) {
  const cursor = new Date();
  if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.has(localDateKey(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
function getBestPracticeStreak(dates: Set<string>) {
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let previous: Date | undefined;
  for (const date of sorted) {
    const current = new Date(`${date}T12:00:00`);
    const difference = previous ? Math.round((current.getTime() - previous.getTime()) / 86400000) : 0;
    run = difference === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}
function scorePracticeAnswer(answer: string) {
  const text = answer.trim();
  const evidence = /\b(i|we)\s+(built|designed|implemented|created|solved|led|analyzed|improved|delivered|tested)\b/i.test(text) || text.length >= 140;
  const structure = /\b(first|then|because|challenge|task|action|result|so that|which meant)\b/i.test(text);
  const outcome = /\b(result|improved|reduced|increased|saved|delivered|launched|users|%|\d+)\b/i.test(text);
  const complete = text.length >= 80;
  return { score: [evidence, structure, outcome, complete].filter(Boolean).length * 25, evidence, structure, outcome, complete };
}

function InterviewPractice({ c }: { c: Ctx }) {
  const today = localDateKey();
  const todaySession = c.records.interviewSessions.find((session) => String(session.practice_date).slice(0, 10) === today);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [party, setParty] = useState(false);
  const prepDateKey = `kariqo-interview-date:${c.userId}`;
  const [interviewDate, setInterviewDate] = useState(() => storage.getItem(prepDateKey) || localDateKey(new Date(Date.now() + 7 * 86400000)));
  const prepProgressKey = `kariqo-interview-prep-progress:${c.userId}:${interviewDate}`;
  const [prepDone, setPrepDone] = useState<boolean[]>(() => {
    try { const value = JSON.parse(storage.getItem(prepProgressKey) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
  });
  const [finalAnswers, setFinalAnswers] = useState<number[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [finalTaken, setFinalTaken] = useState(false);
  const targetSkill = c.records.skills[0]?.name || 'your strongest skill';
  const project = c.records.projects.find((item) => item.status === 'completed') || c.records.projects[0];
  const role = c.goal || 'your target role';
  const questionPrompts: Record<string, string> = {};
  const questions: PracticeQuestion[] = [
    { id: 'role', category: 'ROLE FIT', prompt: `Why are you preparing for ${role}, and what strengths would you bring to a team?`, sample: `“I’m preparing for ${role} because it matches the kind of problems I enjoy solving. My strongest current skill is [name a real skill]. I’m building evidence through [coursework or project], and I’d bring curiosity, clear communication, and a willingness to learn.”` },
    { id: 'skill', category: 'SKILL DEPTH', prompt: `Explain ${targetSkill} with a real example. What problem did you use it to solve, and what trade-offs did you consider?`, sample: `“I used ${targetSkill} in [real project/task] to solve [specific problem]. I chose [approach] because [reason]. I checked the result by [test/measurement], and I would improve it next by [next step].”` },
    { id: 'project', category: 'PROJECT PROOF', prompt: project ? `Walk me through “${project.title}”. What was your contribution, the hardest challenge, and the result?` : 'Describe one project you have built. What problem did it solve, and what would you improve next?', sample: `“The project was [name] and it addressed [problem]. My contribution was [your actual work]. The hardest part was [challenge], so I [action]. The result was [honest outcome], and next I would improve [one thing].”` },
    { id: 'behavior', category: 'BEHAVIOURAL · STAR', prompt: 'Tell me about a time you got stuck while learning or building. What was the situation, what did you do, and what happened?', sample: '“Situation: [context]. Task: I needed to [goal]. Action: I [specific steps and why]. Result: [what changed or what you learned].” This STAR structure is a guide—use a real example.' },
  ];
  questions.forEach((question) => { questionPrompts[question.id] = question.prompt; });
  const sessions = c.records.interviewSessions;
  const practiceDays = new Set(sessions.map((session) => String(session.practice_date).slice(0, 10)));
  const xp = practiceDays.size * 100;
  const streak = getPracticeStreak(practiceDays);
  const bestStreak = getBestPracticeStreak(practiceDays);
  const streakBonus = (bestStreak >= 7 ? 250 : 0) + (bestStreak >= 14 ? 500 : 0) + (bestStreak >= 30 ? 1500 : 0);
  const interviewDayDelta = Math.ceil((new Date(`${interviewDate || today}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  const interviewDaysLeft = Number.isFinite(interviewDayDelta) ? Math.max(1, Math.min(7, interviewDayDelta)) : 7;
  const prepPlan = makeShortInterviewPlan(role, interviewDaysLeft);
  const prepComplete = prepPlan.length > 0 && prepPlan.every((_, index) => Boolean(prepDone[index]));
  const finalQuiz = makeInterviewReadinessQuiz(role);

  useEffect(() => {
    try { const value = JSON.parse(storage.getItem(prepProgressKey) || '[]'); setPrepDone(Array.isArray(value) ? value : []); } catch { setPrepDone([]); }
  }, [prepProgressKey]);
  useEffect(() => {
    try {
      const saved = JSON.parse(storage.getItem(`kariqo-interview-readiness:${c.userId}:${interviewDate}`) || 'null');
      if (saved && Array.isArray(saved.answers) && saved.answers.length === makeInterviewReadinessQuiz(role).length) {
        setFinalAnswers(saved.answers);
        setFinalScore(Number(saved.score));
        setFinalTaken(true);
      } else { setFinalAnswers([]); setFinalScore(null); setFinalTaken(false); }
    } catch { setFinalAnswers([]); setFinalScore(null); setFinalTaken(false); }
  }, [c.userId, interviewDate, role]);

  const saveInterviewDate = (value: string) => {
    setInterviewDate(value);
    storage.setItem(prepDateKey, value);
  };

  const togglePrepDay = (index: number) => {
    setPrepDone((current) => {
      const updated = prepPlan.map((_, itemIndex) => itemIndex === index ? !current[itemIndex] : Boolean(current[itemIndex]));
      storage.setItem(prepProgressKey, JSON.stringify(updated));
      return updated;
    });
  };

  const submitFinalReadiness = () => {
    if (finalAnswers.length !== finalQuiz.length || finalQuiz.some((_, index) => finalAnswers[index] === undefined || finalAnswers[index] < 0)) return c.say('Answer all five readiness questions first.', 'info');
    const score = Math.round(finalQuiz.reduce((sum, question, index) => sum + (finalAnswers[index] === question.answer ? 1 : 0), 0) / finalQuiz.length * 100);
    setFinalScore(score);
    setFinalTaken(true);
    storage.setItem(`kariqo-interview-readiness:${c.userId}:${interviewDate}`, JSON.stringify({ score, answers: finalAnswers, at: new Date().toISOString() }));
  };

  useEffect(() => {
    if (todaySession?.answers && typeof todaySession.answers === 'object') setAnswers(todaySession.answers);
    setSaved(false);
  }, [todaySession?.id]);

  const completePractice = async () => {
    if (!supabase || !c.userId) return c.say('Sign in to save your interview practice.', 'error');
    if (questions.some((question) => String(answers[question.id] || '').trim().length < 20)) {
      return c.say('Write at least a couple of sentences for each interview question before saving.', 'info');
    }
    const score = Math.round(questions.reduce((sum, question) => sum + scorePracticeAnswer(answers[question.id]).score, 0) / questions.length);
    setBusy(true);
    setLoadError('');
    try {
      const { error } = await supabase.from('skillvo_interview_practice').upsert({
        user_id: c.userId, practice_date: today, career_goal: role, answers: { ...answers, __questionPrompts: questionPrompts }, score, completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,practice_date' });
      if (error) throw error;
      await c.refresh();
      setSaved(true);
      if (!todaySession) setParty(true);
      c.say('Daily interview drill saved · +100 XP!', 'success');
    } catch (error) {
      const message = dbMessage(error, 'Could not save interview practice');
      setLoadError(message);
      c.say(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const latestScore = saved ? Math.round(questions.reduce((sum, question) => sum + scorePracticeAnswer(answers[question.id] || '').score, 0) / questions.length) : todaySession?.score;
  return <>
    <Head tag="PRACTICE · REFLECT · IMPROVE" title="Interview Practice" desc={`A private role-focused drill for ${role}. Your answers stay in your Kariqo account.`} />
    <div className="interview-practice-stats"><Panel><Flame size={18} /><b>{streak}</b><small>day streak · best {bestStreak}</small></Panel><Panel><Trophy size={18} /><b>{xp + streakBonus}</b><small>XP · Level {Math.floor((xp + streakBonus) / 300) + 1}</small></Panel><Panel><MessageSquareText size={18} /><b>{sessions.length}</b><small>practice days</small></Panel></div>
    <Panel className="short-interview-prep"><div className="short-prep-heading"><div><small>TIME-BOXED · HIGH-YIELD PREP</small><h2>Interview soon? Study the essentials first.</h2><p>Pick your interview date. Kiko makes a short daily plan around your role, projects, and core interview topics—no deep syllabus.</p></div><span className="short-prep-countdown">{interviewDaysLeft}<small>day{interviewDaysLeft === 1 ? '' : 's'} left</small></span></div><div className="short-prep-controls"><label>Interview date<input type="date" min={today} value={interviewDate} onChange={(event) => saveInterviewDate(event.target.value)} /></label><span>About 25–40 minutes a day · {prepDone.filter(Boolean).length}/{prepPlan.length} days checked</span></div><div className="short-prep-days">{prepPlan.map((item, index) => <label className={prepDone[index] ? 'done' : ''} key={`${index}-${item.title}`}><input type="checkbox" checked={Boolean(prepDone[index])} onChange={() => togglePrepDay(index)} /><span><small>DAY {index + 1} · {item.minutes} MIN</small><b>{item.title}</b><em>{item.detail}</em></span>{prepDone[index] && <Check size={15} />}</label>)}</div><small className="short-prep-note">This plan helps prioritize revision; it can’t predict interview questions or guarantee an outcome.</small></Panel>
    <Panel className={`interview-final-check ${prepComplete ? 'unlocked' : ''}`}><div className="interview-final-head"><div><small>FINAL READINESS CHECK · 5 QUESTIONS</small><h2>{prepComplete ? 'Quick check: are you interview-ready?' : 'Finish your prep plan to unlock the final test'}</h2><p>{prepComplete ? 'Answer five role-focused essentials. A missed answer shows the topic to revise; this score is guidance, not a hiring decision.' : `Complete each of your ${prepPlan.length} short-prep days above. Then this test unlocks.`}</p></div><span>{prepComplete ? 'UNLOCKED' : <LockKeyhole size={16} />}</span></div>
      {prepComplete && <>{finalQuiz.map((question, index) => <fieldset className="interview-final-question" key={question.prompt}><legend>{index + 1}. {question.prompt}</legend>{question.choices.map((choice, choiceIndex) => <label key={choice}><input type="radio" name={`readiness-${index}`} checked={finalAnswers[index] === choiceIndex} onChange={() => setFinalAnswers((old) => { const next = [...old]; next[index] = choiceIndex; return next; })} />{choice}</label>)}</fieldset>)}<div className="interview-final-actions"><button className="primary" onClick={submitFinalReadiness}>{finalTaken ? 'Retake readiness test' : 'Check my readiness'} <ArrowRight size={14} /></button>{finalScore !== null && <div className={`interview-final-result ${finalScore >= 70 ? 'ready' : 'review'}`}><b>{finalScore >= 70 ? `You’re looking ready · ${finalScore}%` : `Keep practising · ${finalScore}%`}</b><span>{finalQuiz.filter((question, index) => finalAnswers[index] !== question.answer).length ? `Revise: ${finalQuiz.filter((question, index) => finalAnswers[index] !== question.answer).map((question) => question.topic).join(', ')}.` : 'All five essentials correct. Keep your project story and questions ready.'}</span></div>}</div></>}
    </Panel>
    <Panel className="interview-practice-intro"><div><small>TODAY'S QUEST · +100 XP</small><h2>Answer four questions using your real learning evidence.</h2><p>Open-ended questions don’t have one exact answer. Kariqo shows a strong answer example and points out what your response can improve. Your answers stay in your account.</p></div><span>{todaySession ? 'Saved today' : 'Not yet completed'}</span></Panel>
    {streakBonus > 0 && <Panel className="streak-reward"><Flame size={16} /><div><b>Streak reward unlocked: +{streakBonus} XP</b><small>Best streak {bestStreak} days · Milestones: 7, 14 and 30 days</small></div></Panel>}
    <div className="interview-question-list">{questions.map((question, index) => {
      const rubric = scorePracticeAnswer(answers[question.id] || '');
      const improve = [!rubric.complete && 'Add a clear, specific explanation.', !rubric.evidence && 'Include what you personally did and a real example.', !rubric.structure && 'Organize it as situation/task → action → result.', !rubric.outcome && 'Finish with the result, impact, or what you learned.'].filter(Boolean);
      return <Panel className="interview-question" key={question.id}><div className="interview-question-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><small>{question.category}</small><h2>{question.prompt}</h2></div><b>{rubric.score}%</b></div><textarea value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Write your answer with a specific example…" rows={4} maxLength={2500} /><div className="interview-rubric"><span className={rubric.complete ? 'met' : ''}>Clear answer</span><span className={rubric.evidence ? 'met' : ''}>Your action or evidence</span><span className={rubric.structure ? 'met' : ''}>Logical structure</span><span className={rubric.outcome ? 'met' : ''}>Result or measurable outcome</span></div><details className="answer-guide"><summary>{rubric.score < 75 ? 'See a strong sample answer and what to improve' : 'See a strong sample answer'}</summary><p><b>Sample answer guide</b><br />{question.sample}</p>{rubric.score < 75 && <p><b>Strengthen your answer:</b> {improve.join(' ')}</p>}</details></Panel>;
    })}</div>
    {loadError && <div className="interview-save-error"><AlertCircle size={15} /> {loadError}</div>}
    <Panel className="interview-save-panel"><div><small>YOUR PRACTICE CHECK-IN</small><h2>{typeof latestScore === 'number' ? `Readiness rubric: ${latestScore}%` : 'Ready to save today’s practice?'}</h2><p>{typeof latestScore === 'number' ? 'Use the checklist above to choose one answer to strengthen next. Scores are a self-practice guide, not a hiring decision.' : 'Your answers are private to your account. Saving your first completed drill today earns 100 XP.'}</p></div><button className="primary" onClick={() => void completePractice()} disabled={busy}>{busy ? 'Saving…' : todaySession ? 'Update today’s practice' : 'Complete today’s quest'} <ArrowRight size={14} /></button></Panel>
    {sessions.length > 0 && <Panel className="interview-history"><h2>Practice history</h2>{sessions.slice(0, 8).map((session) => <details key={session.id} className="interview-history-entry"><summary><span>{new Date(`${String(session.practice_date).slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><span>{session.career_goal || 'Career practice'}</span><b>{session.score}%</b></summary><div>{questions.map((question) => <article key={question.id}><small>{question.category} · {session.answers?.__questionPrompts?.[question.id] || question.prompt}</small><p>{session.answers?.[question.id] || 'No saved answer'}</p></article>)}</div></details>)}</Panel>}
    {party && <CelebrationOverlay title="Interview quest complete!" description={`Great work, ${c.records.profile.full_name?.split(' ')[0] || 'macha'}! You earned 100 XP and built your practice streak.`} onClose={() => setParty(false)} />}
  </>;
}

function makeShortInterviewPlan(role: string, days: number) {
  const normalized = role.toLowerCase();
  const core = normalized.includes('data') || normalized.includes('analyst')
    ? 'Revise SQL joins and aggregations, spreadsheet basics, and how to explain one chart or metric.'
    : normalized.includes('frontend') || normalized.includes('react') || normalized.includes('web')
      ? 'Revise JavaScript fundamentals, React state/props, browser basics, and one debugging example.'
      : normalized.includes('python') || normalized.includes('backend') || normalized.includes('software') || normalized.includes('developer')
        ? 'Revise the language basics, data structures, API/database fundamentals, and one problem-solving example.'
        : `Pick the top three skills in the ${role} job description and revise only their basic concepts.`;
  const week = [
    { title: 'Decode the role', detail: 'Read the job description; mark the 3 most repeated requirements and match each to something you have studied or built.', minutes: 25 },
    { title: 'Revise core must-knows', detail: core, minutes: 35 },
    { title: 'Prepare one project story', detail: 'Explain the problem, your own contribution, one challenge, and the result in 90 seconds. Be honest about what is unfinished.', minutes: 30 },
    { title: 'Practise common questions', detail: 'Answer “Tell me about yourself”, “Why this role?”, and one role-specific fundamentals question aloud.', minutes: 30 },
    { title: 'Build one STAR example', detail: 'Prepare one real teamwork or problem-solving story: Situation, Task, Action, Result. Keep your action specific.', minutes: 25 },
    { title: 'Do a short mock round', detail: 'Answer 4 questions without notes. Review only the two answers that felt weakest and fix those.', minutes: 35 },
    { title: 'Light final review', detail: 'Scan your 3 must-knows and project story, prepare 2 questions for the interviewer, then stop and rest.', minutes: 20 },
  ];
  if (days >= 7) return week;
  if (days === 1) return [{ title: 'One-day essentials', detail: `15 min: identify 3 requirements. 20 min: revise the core must-knows (${core}). 15 min: rehearse one project story and “Tell me about yourself”. 10 min: prepare 2 questions and rest.`, minutes: 60 }];
  if (days === 2) return [
    { title: 'Role essentials + one proof story', detail: `Read the role description, revise the top 3 basics (${core}), then prepare one project example with your contribution and result.`, minutes: 40 },
    { title: 'Practise what interviewers ask most', detail: 'Rehearse “Tell me about yourself”, “Why this role?”, one STAR example, and 2 role questions. Review weak answers only.', minutes: 40 },
  ];
  if (days === 3) return [
    { title: 'Focus on the job requirements', detail: `Mark the top 3 requirements and revise their basics (${core}).`, minutes: 35 },
    { title: 'Prepare project + behavioural proof', detail: 'Practise one project walkthrough and one STAR story using real examples.', minutes: 35 },
    { title: 'Mock + final review', detail: 'Answer 4 common questions aloud, fix the 2 weakest, prepare questions for the interviewer, and rest.', minutes: 35 },
  ];
  return week.slice(0, days);
}

function makeInterviewReadinessQuiz(role: string): { prompt: string; choices: string[]; answer: number; topic: string }[] {
  const normalized = role.toLowerCase();
  const roleQuestion = normalized.includes('data') || normalized.includes('analyst')
    ? { prompt: 'When comparing two groups, what is a good first step?', choices: ['Check that the metric and time period are comparable', 'Choose the group with the bigger number', 'Remove every unusual value', 'Assume the difference is causal'], answer: 0, topic: 'data comparison and metrics' }
    : normalized.includes('frontend') || normalized.includes('react') || normalized.includes('web')
      ? { prompt: 'In React, what should you use when a value changes and the UI must update?', choices: ['A local variable only', 'Component state', 'A CSS comment', 'A new browser tab'], answer: 1, topic: 'React state' }
      : { prompt: 'When a solution fails an edge case, what is the best next step?', choices: ['Hide the failing case', 'Rewrite everything immediately', 'Reproduce it, inspect the input, and add a focused fix/test', 'Assume the reviewer used it incorrectly'], answer: 2, topic: 'debugging and edge cases' };
  return [
    { prompt: 'Before solving a task, what should you clarify first?', choices: ['The expected output and constraints', 'The colour of the UI', 'The company’s entire history', 'Nothing; start coding immediately'], answer: 0, topic: 'problem clarification' },
    roleQuestion,
    { prompt: 'Which project explanation is strongest in an interview?', choices: ['“I did everything” with no detail', 'Problem, your contribution, approach, and honest result', 'Only the tech stack names', 'A result you cannot verify'], answer: 1, topic: 'project evidence and communication' },
    { prompt: 'If you do not know an answer in an interview, what is a strong response?', choices: ['Invent a confident answer', 'Stay silent', 'Explain what you do know and how you would find or test the rest', 'Blame the question'], answer: 2, topic: 'reasoning under uncertainty' },
    { prompt: 'How should you describe a skill you used in a project?', choices: ['Name a real example and what you personally did', 'Claim expert level without evidence', 'List tools you have never used', 'Copy another candidate’s story'], answer: 0, topic: 'evidence-backed skills' },
  ];
}

function CelebrationOverlay({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
  return <div className="kiko-party-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <div className="kiko-party-confetti" aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * -0.19}s`, animationDuration: `${3.1 + (i % 7) * 0.32}s` }} />)}</div>
    <section className="kiko-party-card"><span className="kiko-party-kicker">KARIQO · KIKO CELEBRATES</span><div className="kiko-party-pet"><BuddyCreature mood="excited" appreciating /></div><h2>{title}</h2><p>{description}</p><button className="primary" onClick={onClose}>Continue learning <ArrowRight size={14} /></button></section>
  </div>;
}

type SkillCheckQuestion = { prompt: string; choices: string[]; answer: number; why: string };
const SKILL_CHECKS: Record<string, SkillCheckQuestion[]> = {
  python: [
    { prompt: 'Which Python value is mutable?', choices: ['tuple', 'string', 'list', 'int'], answer: 2, why: 'Lists can be changed in place; tuples, strings and integers are immutable.' },
    { prompt: 'What does a dictionary store?', choices: ['Only ordered numbers', 'Key–value pairs', 'A fixed-size array only', 'Compiled machine code'], answer: 1, why: 'A dict maps unique keys to values for lookup.' },
    { prompt: 'What does `with open(path) as file:` help ensure?', choices: ['The file is closed after the block', 'The file is encrypted', 'The file is sorted', 'The file is always writable'], answer: 0, why: 'A context manager closes the file even if the block raises an error.' },
    { prompt: 'What is the usual purpose of a Python virtual environment?', choices: ['Speed up the CPU', 'Isolate project dependencies', 'Host a website', 'Convert Python to SQL'], answer: 1, why: 'Virtual environments keep each project’s package versions separate.' },
    { prompt: 'A function should return the larger of a and b. Which expression is correct?', choices: ['return a + b', 'return max(a, b)', 'print(a, b)', 'return a == b'], answer: 1, why: '`max(a, b)` returns the greater comparable value.' },
    { prompt: 'What does `try/except` let a program do?', choices: ['Handle expected runtime errors', 'Skip all testing', 'Make every value immutable', 'Install packages'], answer: 0, why: 'It catches selected exceptions so the program can respond safely.' },
    { prompt: 'Which is a good first step when a Python test fails?', choices: ['Delete the test', 'Read the traceback and reproduce the failing case', 'Change random lines', 'Ignore the failure'], answer: 1, why: 'The traceback and a small reproducible case help locate the cause.' },
  ],
  javascript: [
    { prompt: 'Which declaration cannot be reassigned?', choices: ['var', 'let', 'const', 'function'], answer: 2, why: '`const` prevents rebinding the variable (though referenced objects can still mutate).' },
    { prompt: 'What does `Array.map()` return?', choices: ['A new transformed array', 'The first item only', 'A boolean', 'The original array length'], answer: 0, why: '`map` builds a new array from each callback result.' },
    { prompt: 'What does `===` check?', choices: ['Value only after coercion', 'Strict value and type equality', 'Whether a value is truthy', 'Object property order'], answer: 1, why: 'Strict equality does not coerce operand types.' },
    { prompt: 'Why use `await` inside an async function?', choices: ['Wait for a promise result before continuing', 'Repeat a loop forever', 'Create a class', 'Make a value private'], answer: 0, why: '`await` pauses that async function until the promise settles.' },
    { prompt: 'What is event delegation?', choices: ['One ancestor handles bubbled events from descendants', 'Every element gets a timer', 'Events are sent to a server', 'Removing all listeners'], answer: 0, why: 'A parent listener can handle child events using the event target.' },
    { prompt: 'What does `filter()` return?', choices: ['A new array containing matching items', 'A single index', 'A promise always', 'A sorted copy always'], answer: 0, why: '`filter` keeps the elements whose predicate returns true.' },
    { prompt: 'When can a closure access a variable?', choices: ['Only during compilation', 'From its surrounding lexical scope', 'Only if it is global', 'Never after return'], answer: 1, why: 'Closures retain access to variables in their lexical environment.' },
  ],
  sql: [
    { prompt: 'Which clause filters rows before grouping?', choices: ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], answer: 1, why: '`WHERE` filters source rows before aggregation.' },
    { prompt: 'Which clause filters aggregated groups?', choices: ['WHERE', 'HAVING', 'FROM', 'OFFSET'], answer: 1, why: '`HAVING` applies conditions after `GROUP BY` aggregation.' },
    { prompt: 'What does a LEFT JOIN keep?', choices: ['Only matching rows from both tables', 'Every left row and matching right rows', 'Only right table rows', 'Only duplicate rows'], answer: 1, why: 'Unmatched left rows remain, with NULLs for right-side columns.' },
    { prompt: 'What is a primary key?', choices: ['A column that uniquely identifies each row', 'A display label', 'A backup table', 'An index that permits duplicates only'], answer: 0, why: 'A primary key is unique and not null for each row.' },
    { prompt: 'How should a query safely include a user-provided value?', choices: ['Concatenate raw text', 'Use a parameterized query', 'Disable validation', 'Put it in a comment'], answer: 1, why: 'Parameters separate data from SQL syntax and help prevent injection.' },
    { prompt: 'What does `COUNT(*)` count?', choices: ['Only non-null values in one chosen column', 'Rows', 'Unique values only', 'Tables'], answer: 1, why: '`COUNT(*)` counts rows in the result set.' },
    { prompt: 'Which index trade-off is generally true?', choices: ['Faster reads, extra storage and write cost', 'No storage cost', 'Always faster writes', 'It removes the need for constraints'], answer: 0, why: 'Indexes can speed lookups but take space and must be maintained on writes.' },
  ],
  react: [
    { prompt: 'What should a React component do with props?', choices: ['Treat them as read-only inputs', 'Mutate them directly', 'Store them in localStorage automatically', 'Use them as SQL'], answer: 0, why: 'Props flow into a component as read-only inputs.' },
    { prompt: 'What is a React key used for in a rendered list?', choices: ['Help React identify items between renders', 'Encrypt the list', 'Sort items alphabetically', 'Create CSS variables'], answer: 0, why: 'Stable keys help React match list items when they change.' },
    { prompt: 'When is a state setter appropriate?', choices: ['To request a state update and re-render', 'To mutate the DOM directly', 'To define a route', 'To install a package'], answer: 0, why: 'State setters notify React to render with the new state.' },
    { prompt: 'What should an effect cleanup do when needed?', choices: ['Undo subscriptions/timers from the effect', 'Delete all component state', 'Run before every click', 'Replace JSX'], answer: 0, why: 'Cleanup prevents stale subscriptions, timers, and related leaks.' },
    { prompt: 'Why avoid mutating an object in state?', choices: ['React may not detect the update reliably', 'Objects cannot be rendered', 'It disables JavaScript', 'It always causes a network call'], answer: 0, why: 'Create a new object so identity changes and React can see the update.' },
    { prompt: 'What is a controlled input?', choices: ['An input whose value is driven by React state', 'An input with no label', 'A browser extension', 'An input only for numbers'], answer: 0, why: 'React state is the source of truth for its displayed value.' },
    { prompt: 'Where should a component-specific derived value usually come from?', choices: ['Compute it from current props/state', 'Duplicate it in unrelated state', 'Hard-code the last result', 'Store it in a global variable'], answer: 0, why: 'Derived values are often safest when computed from their source data.' },
  ],
};

function getSkillCheck(name: string) {
  const key = name.trim().toLowerCase().replace(/\s+/g, '');
  if (key.includes('python')) return SKILL_CHECKS.python;
  if (key === 'js' || key.includes('javascript')) return SKILL_CHECKS.javascript;
  if (key === 'sql' || key.includes('sql')) return SKILL_CHECKS.sql;
  if (key.includes('react')) return SKILL_CHECKS.react;
  return null;
}

function DNA({ c }: { c: Ctx }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [check, setCheck] = useState<SkillCheckQuestion[] | null>(null);
  const [selections, setSelections] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [party, setParty] = useState(false);

  const startAssessment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '').trim();
    const bank = getSkillCheck(name);
    if (!bank) return c.say('Question assessment is currently available for Python, JavaScript, SQL and React.', 'info');
    // Pick five questions at random so repeat checks vary.
    const shuffled = [...bank].sort(() => Math.random() - 0.5).slice(0, 5);
    setSkillName(name);
    setCheck(shuffled);
    setSelections(Array(shuffled.length).fill(-1));
    setResult(null);
  };

  const saveAssessment = async () => {
    if (!supabase || !c.userId) return c.say('Sign in to save your Skill DNA assessment.', 'error');
    if (!check || selections.some((value) => value < 0)) return c.say('Answer every question to calculate your skill score.', 'info');
    const correct = check.reduce((count, question, index) => count + (selections[index] === question.answer ? 1 : 0), 0);
    const score = Math.round((correct / check.length) * 100);
    setBusy(true);
    try {
      const { error } = await supabase.from('skills').upsert({ user_id: c.userId, name: skillName, score }, { onConflict: 'user_id,name' });
      if (error) throw error;
      await c.refresh();
      setResult({ score, correct, total: check.length });
      if (score === 100) setParty(true);
      c.say(score === 100 ? 'Perfect check — skill mastered! Kiko is celebrating.' : 'Quiz-based Skill DNA score saved.', 'success');
    } catch (e) {
      c.say(dbMessage(e, 'Could not save skill assessment'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!supabase || !c.userId) return;
    try {
      const { error } = await supabase.from('skills').delete().eq('id', id).eq('user_id', c.userId);
      if (error) throw error;
      await c.refresh();
      c.say('Skill removed from profile', 'info');
    } catch (e) {
      c.say(dbMessage(e, 'Could not remove skill'), 'error');
    }
  };

  return (
    <>
      <Head
        tag="YOUR CAPABILITIES"
        title="Skill DNA"
        desc="Skill levels come from a short knowledge check, not a manually selected percentage. Retake a check as you learn."
        action={
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Add a skill
          </button>
        }
      />
      <div className="cards four">
        {c.records.skills.map((k) => (
          <Panel key={k.id} style={{ position: 'relative' }}>
            <button
              onClick={() => remove(k.id)}
              title="Remove skill"
              style={{ position: 'absolute', top: '12px', right: '12px', color: '#9ca3af' }}
            >
              <Trash2 size={14} />
            </button>
            <div className="cap-icon">
              <Activity />
            </div>
            <small>YOUR SKILL</small>
            <h3>{k.name}</h3>
            <b>{k.score}%</b>
            <Progress value={k.score} />
            <p>Recorded level · Retake to refresh with a quiz · {new Date(k.updated_at || Date.now()).toLocaleDateString()}</p>
            <button className="secondary skill-reassess" onClick={() => { setSkillName(k.name); setCheck(null); setResult(null); setSelections([]); setOpen(true); }}>Retake assessment</button>
          </Panel>
        ))}
      </div>
      {!c.records.skills.length && (
        <Panel>
          <h3>No skills added yet</h3>
          <p>Add a skill, then answer a short quiz. Kariqo calculates and saves the score for you.</p>
          <button className="secondary" onClick={() => setOpen(true)} style={{ marginTop: '12px' }}>
            Add your first skill
          </button>
        </Panel>
      )}
      {open && <div className="skill-check-backdrop" role="dialog" aria-modal="true" aria-label="Skill DNA knowledge check"><section className="skill-check-modal">
        <button className="skill-check-close" onClick={() => { setOpen(false); setCheck(null); setResult(null); }} aria-label="Close"><X size={18} /></button>
        <small className="skill-check-kicker">SKILL DNA · KNOWLEDGE CHECK</small>
        {!check ? <form onSubmit={startAssessment}><h2>Measure with questions</h2><p>Choose a supported skill. We’ll ask five changing questions and calculate your score automatically.</p><label>Skill name<input name="name" defaultValue={skillName} placeholder="Python, JavaScript, SQL or React" required autoFocus /></label><small className="skill-supported">Question checks available now: Python · JavaScript · SQL · React</small><div className="skill-check-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="primary">Start assessment <ArrowRight size={14} /></button></div></form> : <><h2>{skillName} assessment</h2><p>Choose one answer for every question. Your percentage is calculated from correct answers.</p><div className="skill-check-questions">{check.map((question, index) => <article key={`${index}-${question.prompt}`}><b>{index + 1}. {question.prompt}</b>{question.choices.map((choice, choiceIndex) => <label key={choice}><input type="radio" name={`skill-q-${index}`} checked={selections[index] === choiceIndex} onChange={() => setSelections((current) => current.map((value, i) => i === index ? choiceIndex : value))} />{choice}</label>)}{result && <small className={selections[index] === question.answer ? 'skill-correct' : 'skill-wrong'}>{selections[index] === question.answer ? 'Correct. ' : `Review this: ${question.why}`}</small>}</article>)}</div>{result && <div className="skill-check-result"><b>{result.score}% · {result.correct}/{result.total} correct</b><p>{result.score === 100 ? 'You cleared this check. Kiko’s celebration means mastery of this quiz, and you can keep building real project evidence too.' : 'Review the explanations above, study the missed topics, then retake for a fresh set of questions.'}</p></div>}<div className="skill-check-actions">{result ? <button className="secondary" onClick={() => { setCheck(null); setResult(null); }}>Try another set</button> : <button className="secondary" onClick={() => setCheck(null)}>Back</button>}{result ? <button className="primary" onClick={() => { setOpen(false); setCheck(null); }}>Done</button> : <button className="primary" disabled={busy || selections.some((value) => value < 0)} onClick={() => void saveAssessment()}>{busy ? 'Calculating…' : 'Calculate my level'} <ArrowRight size={14} /></button>}</div></>}
      </section></div>}
      {party && <CelebrationOverlay title="Skill check mastered!" description={`Perfect ${result?.total}/${result?.total} on ${skillName}! Keep applying it in projects to grow real evidence.`} onClose={() => setParty(false)} />}
    </>
  );
}

function Roadmap({ c }: { c: Ctx }) {
  const [busy, setBusy] = useState(false);
  const record = c.records.roadmaps[0];
  type WeekProgress = { activities: Record<number, number[]>; answers: Record<number, string[]>; completedTests: number[] };
  const progressKey = `kariqo-week-progress:${c.userId}:${record?.id || record?.created_at || c.goal}`;
  const [weekProgress, setWeekProgress] = useState<WeekProgress>({ activities: {}, answers: {}, completedTests: [] });

  useEffect(() => {
    try {
      const saved = storage.getItem(progressKey);
      setWeekProgress(saved ? JSON.parse(saved) : { activities: {}, answers: {}, completedTests: [] });
    } catch {
      setWeekProgress({ activities: {}, answers: {}, completedTests: [] });
    }
  }, [progressKey]);

  const updateWeekProgress = (next: WeekProgress) => {
    setWeekProgress(next);
    storage.setItem(progressKey, JSON.stringify(next));
  };

  const generate = async () => {
    if (!c.goal.trim()) {
      return c.say('Please set your career goal first', 'error');
    }

    setBusy(true);
    try {
      // Save career goal to profile
      if (supabase && c.userId) {
        await supabase.from('profiles').update({ career_goal: c.goal }).eq('id', c.userId);
      }

      await requestAiRoadmap(c.goal, c.records.skills, c.userId);
      await c.refresh();
      c.say('AI Roadmap generated and saved to your account!', 'success');
    } catch (e) {
      c.say(e instanceof Error ? e.message : 'Could not generate roadmap', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGoalBlur = async () => {
    if (supabase && c.userId && c.goal.trim()) {
      try {
        await supabase.from('profiles').update({ career_goal: c.goal }).eq('id', c.userId);
      } catch {
        // silent
      }
    }
  };

  const content = record?.content;
  const roadmapWeeks: { week: number; title: string; activities: string[]; outcome: string }[] = content?.weeks || [];
  const orderedWeekNumbers = roadmapWeeks.map((week, index) => Number(week.week || index + 1));

  return (
    <>
      <Head
        tag="YOUR PERSONALIZED PLAN"
        title="AI Roadmap"
        desc="A private roadmap generated for your career goal and skills."
        action={
          <button className="primary" onClick={generate} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? 'Analyzing with AI…' : 'Generate with AI'}
          </button>
        }
      />

      <Panel className="goal">
        <Target />
        <div>
          <small>MY CAREER GOAL</small>
          <input
            value={c.goal}
            onChange={(e) => c.setGoal(e.target.value)}
            onBlur={handleGoalBlur}
            placeholder="e.g. Full Stack Web Developer, Machine Learning Engineer"
          />
        </div>
      </Panel>

      {record ? (
        <>
          <Panel>
            <small>
              {record.career_goal} · {new Date(record.created_at).toLocaleDateString()}
            </small>
            <h2>{content?.summary || 'Your personalized roadmap'}</h2>
            {content?.strengths?.length > 0 && (
              <section>
                <h3>Skills you already have</h3>
                <div className="chips">
                  {content.strengths.map((skill: string) => (
                    <span className="chip" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </Panel>

          {content?.gaps?.length > 0 && (
            <Panel>
              <h3>Skills to build</h3>
              <div className="roadmap-list">
                {content.gaps.map((gap: { skill: string; priority: string; reason: string; first_step: string }, i: number) => (
                  <article key={gap.skill || i}>
                    <span className="roadmap-number">{i + 1}</span>
                    <div>
                      <b>{gap.skill}</b>
                      <small>{gap.priority} priority</small>
                      <p>{gap.reason}</p>
                      {gap.first_step && (
                        <p>
                          <b>First step:</b> {gap.first_step}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          )}

          {roadmapWeeks.length > 0 && (
            <Panel>
              <h3>Your six-week plan</h3>
              <div className="roadmap-list">
                {roadmapWeeks.map((week, i: number) => {
                  const weekNumber = Number(week.week || i + 1);
                  const activities = week.activities || [];
                  const doneActivities = weekProgress.activities[weekNumber] || [];
                  const quizDone = weekProgress.completedTests.includes(weekNumber);
                  const orderedIndex = orderedWeekNumbers.indexOf(weekNumber);
                  const previousWeek = orderedIndex > 0 ? orderedWeekNumbers[orderedIndex - 1] : null;
                  const previousWeekActivities = previousWeek === null ? [] : (roadmapWeeks[orderedIndex - 1]?.activities || []);
                  const previousTasksDone = previousWeek !== null && (previousWeekActivities.length === 0 || (weekProgress.activities[previousWeek] || []).length >= previousWeekActivities.length);
                  const weekLocked = previousWeek !== null && (!weekProgress.completedTests.includes(previousWeek) || !previousTasksDone);
                  const quizUnlocked = !weekLocked && (activities.length === 0 || doneActivities.length >= activities.length);
                  const prompts = [
                    `Explain the main idea in “${week.title}” in your own words.`,
                    `What steps would you take to achieve this week's outcome: ${week.outcome || 'complete the planned activities'}?`,
                    'What work or evidence would you show to prove you understand this week’s topic?',
                  ];
                  const testAnswers = weekProgress.answers[weekNumber] || [];
                  const answerWordCounts = prompts.map((_, questionIndex) => (testAnswers[questionIndex] || '').trim().split(/\s+/).filter(Boolean).length);
                  const canSubmitTest = answerWordCounts.every((count) => count >= 12);
                  return <article className="roadmap-week-card" key={weekNumber}>
                    <span className={`roadmap-number ${quizDone ? 'week-complete' : weekLocked ? 'week-locked' : ''}`}>{quizDone ? <Check size={14} /> : weekLocked ? <LockKeyhole size={13} /> : weekNumber}</span>
                    <div>
                      <b>{week.title}</b>
                      <small>{weekLocked ? `Locked · Pass Week ${previousWeek} test to unlock` : `${doneActivities.length}/${activities.length} activities complete`}</small>
                      <ul className="roadmap-activities">
                        {activities.map((activity: string, j: number) => <li key={j}>
                          <label className={doneActivities.includes(j) ? 'activity-done' : ''}><input type="checkbox" checked={doneActivities.includes(j)} disabled={quizDone || weekLocked} onChange={(event) => {
                            const nextIndexes = event.target.checked ? [...doneActivities, j] : doneActivities.filter((index) => index !== j);
                            updateWeekProgress({ ...weekProgress, activities: { ...weekProgress.activities, [weekNumber]: nextIndexes } });
                          }} /> <span>{activity}</span></label>
                        </li>)}
                      </ul>
                      {week.outcome && <small>By the end: {week.outcome}</small>}
                      <section className={`weekly-test ${quizUnlocked ? 'unlocked' : ''} ${weekLocked ? 'locked' : ''}`}>
                        <div className="weekly-test-heading"><b>{weekLocked ? <LockKeyhole size={14} /> : quizDone ? <Check size={14} /> : <Target size={14} />} Week {weekNumber} test</b><small>{quizDone ? 'Passed · next week unlocked' : weekLocked ? `Pass Week ${previousWeek} first` : quizUnlocked ? 'Ready to take' : 'Tick every activity to unlock'}</small></div>
                        {quizUnlocked && !quizDone && <>
                          <p>Answer all three in your own words. Write at least 12 meaningful words for each answer to pass this learning checkpoint.</p>
                          {prompts.map((prompt, questionIndex) => <label className="weekly-test-question" key={questionIndex}>
                            <span>{questionIndex + 1}. {prompt}</span>
                            <textarea value={weekProgress.answers[weekNumber]?.[questionIndex] || ''} maxLength={1000} rows={2} placeholder="Write your answer…" onChange={(event) => {
                              const answers = [...(weekProgress.answers[weekNumber] || ['', '', ''])];
                              answers[questionIndex] = event.target.value;
                              updateWeekProgress({ ...weekProgress, answers: { ...weekProgress.answers, [weekNumber]: answers } });
                            }} /><small className={answerWordCounts[questionIndex] >= 12 ? 'weekly-answer-ready' : 'weekly-answer-short'}>{answerWordCounts[questionIndex]}/12 words</small>
                          </label>)}
                          <button className="primary" onClick={() => {
                            const answers = weekProgress.answers[weekNumber] || [];
                            const wordCounts = prompts.map((_, index) => (answers[index] || '').trim().split(/\s+/).filter(Boolean).length);
                            if (wordCounts.some((count) => count < 12)) return c.say('For a pass, answer all three questions with at least 12 meaningful words each.', 'error');
                            updateWeekProgress({ ...weekProgress, completedTests: [...weekProgress.completedTests, weekNumber] });
                            c.say(`Week ${weekNumber} test passed! Week ${weekNumber + 1} is unlocked.`, 'success');
                          }} disabled={!canSubmitTest}>Pass test & unlock next week <ArrowRight size={14} /></button>
                        </>}
                        {weekLocked && <p>Finish all tasks and pass Week {previousWeek}’s test before this week’s tasks become available.</p>}
                        {!weekLocked && !quizDone && !quizUnlocked && <p>Tick all {activities.length} activities above to open this week’s test.</p>}
                        {quizDone && <p>Your test answers are saved on this browser. Week {weekNumber} is complete, and the next week is now available.</p>}
                      </section>
                    </div>
                  </article>;
                })}
              </div>
            </Panel>
          )}

          {content?.project_ideas?.length > 0 && (
            <Panel>
              <h3>Portfolio project ideas</h3>
              {content.project_ideas.map((project: { title: string; description: string; skills_used: string[] }, i: number) => (
                <div className="roadmap-project" key={project.title || i}>
                  <b>{project.title}</b>
                  <p>{project.description}</p>
                  <small>Skills: {(project.skills_used || []).join(' · ')}</small>
                </div>
              ))}
            </Panel>
          )}

          {content?.next_action && (
            <Panel className="roadmap-next">
              <Sparkles />
              <div>
                <small>START TODAY</small>
                <p>{content.next_action}</p>
              </div>
            </Panel>
          )}
        </>
      ) : (
        <Panel>
          <h3>No roadmap yet</h3>
          <p>Set your career goal and add your current skills, then click "Generate with AI" to create your personal skill-gap analysis and six-week plan.</p>
          <p>Your plan will include skills to build, weekly activities, portfolio project ideas, and one concrete next step.</p>
          <button className="primary" onClick={generate} disabled={busy} style={{ marginTop: '16px' }}>
            {busy ? 'Analyzing with AI…' : 'Generate with AI'} <Sparkles size={16} />
          </button>
        </Panel>
      )}
    </>
  );
}

type CopilotMessage = { role: 'user' | 'assistant'; text: string; destination?: Page; image?: string; redirectToStudies?: boolean };
type CopilotPhoto = { name: string; data: string; mimeType: string; preview: string };

async function prepareCopilotPhoto(file: File): Promise<CopilotPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not open this image.')); };
    img.src = url;
  });
  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare this image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not compress this image.')), 'image/jpeg', 0.82));
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(blob);
  });
  return { name: file.name, data: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl };
}

function CareerCopilot({ c }: { c: Ctx }) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<CopilotPhoto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [kikoNudge, setKikoNudge] = useState<CopilotMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const starters = ['What should I learn next?', 'Review my learning progress', 'Help me prepare for an interview'];

  useEffect(() => {
    if (!kikoNudge) return;
    const timer = window.setTimeout(() => setKikoNudge(null), 9000);
    return () => window.clearTimeout(timer);
  }, [kikoNudge]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speakAsKiko = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text.slice(0, 360));
    speech.lang = 'en-IN';
    speech.pitch = 1.12;
    speech.rate = 0.94;
    const voices = window.speechSynthesis.getVoices();
    speech.voice = voices.find((voice) => /female|samantha|karen|zira|google.*english.*female/i.test(voice.name)) || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-in')) || null;
    window.speechSynthesis.speak(speech);
  };

  const send = async (raw = draft) => {
    const attached = photo;
    const message = raw.trim() || (attached ? 'Please look at this picture, explain what you can see, and answer my question about it.' : '');
    if ((!message && !attached) || busy) return;
    if (!supabase) return c.say('Kariqo backend is not connected', 'error');
    const nextMessages = [...messages, { role: 'user' as const, text: message, image: attached?.preview }];
    setMessages(nextMessages);
    setDraft('');
    setPhoto(null);
    setBusy(true);
    try {
      const roadmap = c.records.roadmaps[0];
      const snapshot = {
        name: c.user,
        careerGoal: c.goal || c.records.profile.career_goal || '',
        skills: c.records.skills.slice(0, 30).map((skill) => ({ name: skill.name, level: skill.score })),
        learningPlan: roadmap ? { goal: roadmap.career_goal, result: roadmap.content } : null,
        projects: c.records.projects.slice(0, 12).map((project) => ({ title: project.title, description: project.description, status: project.status, progress: project.progress })),
        classes: { enrolled: c.records.attendance.length, attended: c.records.attendance.filter((row) => ['present', 'late'].includes(row.attendance_status)).length },
        assignmentReviews: c.records.assignmentScores.length,
        interviewPractices: c.records.interviewSessions.length,
        jobApplications: c.records.applications.slice(0, 8).map((application) => ({ title: application.job_title, company: application.company_name, status: application.status })),
        availableFeatures: ['Skill DNA', 'AI Roadmap', 'Interview Practice', 'Projects', 'Skill Passport', 'Opportunities', 'Job Offers', 'Applications', 'Mentor', 'Live Classes'],
      };
      const { data, error } = await supabase.functions.invoke('career-copilot', {
        body: { message, image: attached ? { mimeType: attached.mimeType, data: attached.data } : undefined, history: messages.slice(-8).map(({ role, text }) => ({ role, text })), context: snapshot },
      });
      if (error) throw new Error(await functionErrorMessage(error, 'Career Copilot could not reply'));
      if (data?.error) throw new Error(data.error);
      const allowedPages: Page[] = ['Skill DNA', 'AI Roadmap', 'Interview Practice', 'Projects', 'Skill Passport', 'Opportunities', 'Job Offers', 'Applications', 'Mentor', 'Live Classes', 'Profile & Settings'];
      const destination = allowedPages.includes(data?.destination) ? data.destination as Page : data?.redirectToStudies ? 'AI Roadmap' : undefined;
      const reply = String(data?.reply || 'I could not form a response. Try asking in a different way.');
      const assistantMessage: CopilotMessage = { role: 'assistant', text: reply, destination, redirectToStudies: data?.redirectToStudies === true };
      setMessages((items) => [...items, assistantMessage]);
      if (assistantMessage.redirectToStudies) {
        setKikoNudge(assistantMessage);
        window.setTimeout(() => speakAsKiko("Hey! Let's bring this back to your learning goal. Shall we check your roadmap?"), 650);
      }
    } catch (error) {
      const messageText = dbMessage(error, 'Career Copilot is temporarily unavailable. Try again shortly.');
      setMessages((items) => [...items, { role: 'assistant', text: messageText }]);
    } finally {
      setBusy(false);
    }
  };

  return <>
    <Head tag="PERSONALIZED CAREER GUIDANCE" title="Career Copilot" desc="Ask for guidance based on your Kariqo profile, skills, study progress, projects, and career goal." />
    <Panel className="copilot-shell">
      <div className="copilot-context"><span className="copilot-avatar"><Sparkles size={17} /></span><div><b>Your Kariqo Career Copilot</b><small>Uses your profile and learning activity to make relevant suggestions.</small></div><span className="copilot-context-count">{c.records.skills.length} skills · {c.records.projects.length} projects</span></div>
      <div className="copilot-messages" aria-live="polite">
        {!messages.length && <div className="copilot-welcome"><span><Sparkles size={20} /></span><h2>Let’s plan your next step.</h2><p>I can use your goal, Skill DNA, roadmap, projects, classes, and interview practice to give guidance that fits your progress.</p><div>{starters.map((starter) => <button key={starter} className="secondary" disabled={busy} onClick={() => void send(starter)}>{starter} <ArrowRight size={13} /></button>)}</div></div>}
        {messages.map((item, index) => <article className={`copilot-message ${item.role}`} key={`${index}-${item.role}`}><span className="copilot-message-avatar">{item.role === 'assistant' ? <Sparkles size={14} /> : c.user.slice(0, 1).toUpperCase()}</span><div><small>{item.role === 'assistant' ? 'CAREER COPILOT' : 'YOU'}</small>{item.image && <img className="copilot-photo-message" src={item.image} alt="Image attached for study analysis" />}<p>{item.text}</p>{item.destination && <button className="copilot-destination" onClick={() => c.setPage(item.destination!)}>Open {item.destination} <ArrowRight size={13} /></button>}</div></article>)}
        {busy && <div className="copilot-thinking"><Loader2 size={15} className="animate-spin" /> Looking at your Kariqo progress…</div>}
      </div>
      <form className="copilot-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        {photo && <div className="copilot-photo-attachment"><img src={photo.preview} alt="Selected image preview" /><span>{photo.name} · sent to Kariqo AI for analysis</span><button type="button" aria-label="Remove attached photo" onClick={() => setPhoto(null)}><X size={14} /></button></div>}
        <input ref={photoInput} className="copilot-photo-input" type="file" accept="image/*" aria-label="Attach a study image" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setPhotoBusy(true); try { setPhoto(await prepareCopilotPhoto(file)); } catch (error) { c.say(error instanceof Error ? error.message : 'Could not prepare this image.', 'error'); } finally { setPhotoBusy(false); event.target.value = ''; } }} />
        <button type="button" className="copilot-image-button" aria-label="Add a photo for AI analysis" title="Add a photo for AI analysis" disabled={photoBusy || busy} onClick={() => photoInput.current?.click()}>{photoBusy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={17} />}<span>{photoBusy ? 'Preparing…' : 'Photo'}</span></button>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} maxLength={1200} placeholder="Ask about your studies, attach a picture, or prepare for an interview…" aria-label="Message Career Copilot" />
        <button className="primary" disabled={busy || photoBusy || (!draft.trim() && !photo)} aria-label="Send message">{busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}<span>Send</span></button>
        <small>Images are sent to Kariqo AI (Gemini) for analysis. Avoid private or sensitive photos. Off-topic chat is gently redirected to your learning plan.</small>
      </form>
    </Panel>
    {kikoNudge && <div className="copilot-kiko-nudge" role="dialog" aria-live="polite" aria-label="Kiko study reminder"><div className="copilot-kiko-walker"><BuddyCreature mood="supportive" /></div><div className="copilot-kiko-speech"><small>KIKO · STUDY REMINDER</small><p>{kikoNudge.text}</p><button onClick={() => { c.setPage(kikoNudge.destination || 'AI Roadmap'); setKikoNudge(null); }}>Back to my studies <ArrowRight size={13} /></button><button className="copilot-kiko-close" aria-label="Close Kiko reminder" onClick={() => { window.speechSynthesis?.cancel(); setKikoNudge(null); }}><X size={14} /></button></div></div>}
  </>;
}

type GitHubProgressEstimate = { score: number; evidence: string[] };
function parsePublicGitHubRepo(raw: string) {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
  } catch { return null; }
}

async function estimateGitHubProgress(repositoryUrl: string): Promise<GitHubProgressEstimate> {
  const repository = parsePublicGitHubRepo(repositoryUrl);
  if (!repository) throw new Error('Use a public GitHub repository link, such as https://github.com/owner/repository.');
  const base = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const repoResponse = await fetch(base, { headers });
  if (repoResponse.status === 404) throw new Error('GitHub repo not found or private. Only public GitHub repositories can sync without connecting an account.');
  if (repoResponse.status === 403) throw new Error('GitHub public API rate limit reached. Try refreshing later.');
  if (!repoResponse.ok) throw new Error('Could not read this public GitHub repository.');
  const repoData = await repoResponse.json();
  if (repoData.private) throw new Error('This repository is private. Connect a GitHub account to sync it.');
  const treeResponse = await fetch(`${base}/git/trees/${encodeURIComponent(repoData.default_branch)}?recursive=1`, { headers });
  if (!treeResponse.ok) throw new Error('Could not read the repository file list. Check GitHub API access and try again.');
  const treeData = await treeResponse.json();
  const paths: string[] = (treeData.tree || []).filter((entry: { type: string }) => entry.type === 'blob').map((entry: { path: string }) => entry.path.toLowerCase());
  const checks: [string, boolean, number][] = [
    ['Source files', paths.some((path) => /\.(tsx?|jsx?|py|java|kt|go|rs|cs|php|rb|html|css|vue|svelte)$/.test(path) && !/(^|\/)(node_modules|dist|build|vendor)\//.test(path)), 30],
    ['README', paths.some((path) => /(^|\/)readme(?:\.md|\.rst|\.txt)?$/.test(path)), 15],
    ['Tests', paths.some((path) => /(^|\/)(__tests__|tests?|specs?)(\/|\.)/.test(path) || /\.(test|spec)\.[^.]+$/.test(path)), 15],
    ['Project setup', paths.some((path) => /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|pom\.xml|cargo\.toml|go\.mod|composer\.json|pubspec\.yaml)$/.test(path)), 10],
    ['CI workflow', paths.some((path) => path.startsWith('.github/workflows/')), 10],
    ['Deployment setup', paths.some((path) => /(^|\/)(netlify\.toml|vercel\.json|render\.yaml|dockerfile|\.dockerignore)$/.test(path)), 10],
    ['Documentation or examples', paths.some((path) => /(^|\/)(docs|examples|screenshots)\//.test(path)), 10],
  ];
  const evidence = checks.filter(([, present]) => present).map(([label]) => label as string);
  return { score: Math.min(100, 10 + checks.filter(([, present]) => present).reduce((sum, [, , points]) => sum + points, 0)), evidence };
}

function Projects({ c }: { c: Ctx }) {
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const saveProject = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase || !c.userId) return c.say('Kariqo backend is not connected', 'error');
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title') || '').trim();
    const description = String(f.get('description') || '').trim();
    const repositoryUrl = String(f.get('repository_url') || '').trim();
    const demoUrl = String(f.get('demo_url') || '').trim();

    if (!title) return c.say('Enter a project name', 'error');
    if (repositoryUrl && !parsePublicGitHubRepo(repositoryUrl)) return c.say('Add a public GitHub repository link.', 'error');
    if (demoUrl && !/^https:\/\//i.test(demoUrl)) return c.say('Live project links must start with https://.', 'error');
    const parsedRepo = repositoryUrl ? parsePublicGitHubRepo(repositoryUrl) : null;
    const normalizedRepoUrl = parsedRepo ? `https://github.com/${parsedRepo.owner}/${parsedRepo.repo}` : '';
    setBusy(true);
    try {
      const projectData = {
        title,
        description,
        repository_url: normalizedRepoUrl || null,
        demo_url: demoUrl || null,
        ...(repositoryUrl ? { progress: 0, progress_source: 'github', progress_checked_at: null } : {}),
        ...(!repositoryUrl && editingProject?.repository_url ? { progress: 0, progress_source: 'manual', progress_checked_at: null } : {}),
      };
      const { error } = editingProject
        ? await supabase.from('projects').update(projectData).eq('id', editingProject.id).eq('user_id', c.userId)
        : await supabase.from('projects').insert({ user_id: c.userId, ...projectData, status: 'in_progress', progress: 0 });
      if (error) throw error;
      await c.refresh();
      setOpen(false);
      setEditingProject(null);
      c.say(repositoryUrl ? 'Project saved. Public GitHub progress will sync automatically.' : 'Project saved to your account', 'success');
    } catch (e) {
      c.say(dbMessage(e, 'Could not save project'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const syncProject = async (project: Record<string, any>, quiet = false) => {
    if (!supabase || !c.userId || !project.repository_url) return;
    setSyncing((current) => ({ ...current, [project.id]: true }));
    try {
      const estimate = await estimateGitHubProgress(project.repository_url);
      const { error } = await supabase.from('projects').update({
        progress: estimate.score,
        progress_source: `github:${estimate.evidence.join(',')}`,
        progress_checked_at: new Date().toISOString(),
      }).eq('id', project.id).eq('user_id', c.userId);
      if (error) throw error;
      await c.refresh();
      if (!quiet) c.say(`GitHub repository synced · estimated progress ${estimate.score}%`, 'success');
    } catch (error) {
      if (!quiet) c.say(dbMessage(error, 'Could not sync GitHub repository'), 'error');
    } finally {
      setSyncing((current) => ({ ...current, [project.id]: false }));
    }
  };

  const toggleProjectCompletion = async (project: Record<string, any>) => {
    if (!supabase || !c.userId) return;
    const status = project.status === 'completed' ? 'in_progress' : 'completed';
    const { error } = await supabase.from('projects').update({ status }).eq('id', project.id).eq('user_id', c.userId);
    if (error) return c.say(dbMessage(error, 'Could not update project status'), 'error');
    await c.refresh();
    c.say(status === 'completed' ? 'Project marked complete' : 'Project moved back to in progress', 'success');
  };

  const projectSyncKey = c.records.projects.map((project) => `${project.id}:${project.repository_url || ''}:${project.progress_checked_at || ''}`).join('|');
  const syncDueProjects = () => {
    const due = c.records.projects.filter((project) => project.repository_url && (!project.progress_checked_at || Date.now() - new Date(project.progress_checked_at).getTime() > 30 * 60 * 1000));
    due.forEach((project) => void syncProject(project, true));
  };
  useEffect(() => { syncDueProjects(); }, [projectSyncKey]);
  useEffect(() => {
    const timer = window.setInterval(syncDueProjects, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [projectSyncKey]);

  const editProject = (project: Record<string, any>) => { setEditingProject(project); setOpen(true); };

  const remove = async (id: string) => {
    if (!supabase || !c.userId) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', c.userId);
      if (error) throw error;
      await c.refresh();
      c.say('Project removed', 'info');
    } catch (e) {
      c.say(dbMessage(e, 'Could not remove project'), 'error');
    }
  };

  return (
    <>
      <Head
        tag="LEARN BY DOING"
        title="Projects & challenges"
        desc="Add your real project and public GitHub link. Kariqo checks repository structure and refreshes an estimated progress score."
        action={
          <button className="primary" onClick={() => { setEditingProject(null); setOpen(true); }}>
            <Plus size={16} /> New project
          </button>
        }
      />
      <div className="cards three">
        {c.records.projects.map((p) => (
          <Panel key={p.id} style={{ position: 'relative' }}>
            <button
              onClick={() => remove(p.id)}
              title="Remove project"
              style={{ position: 'absolute', top: '12px', right: '12px', color: '#9ca3af' }}
            >
              <Trash2 size={14} />
            </button>
            <div className="cap-icon">
              <Code2 />
            </div>
            <small>{p.status}</small>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            {p.repository_url && <a className="project-repository-link" href={p.repository_url} target="_blank" rel="noreferrer">Open GitHub project <ArrowRight size={12} /></a>}
            {p.demo_url && <a className="project-repository-link" href={p.demo_url} target="_blank" rel="noreferrer">Preview live project <ArrowRight size={12} /></a>}
            <div className="project-progress-heading"><b>{Number(p.progress) || 0}%</b><small>{p.repository_url ? 'GitHub repository estimate' : 'Add GitHub link to estimate'}</small></div>
            <Progress value={p.progress} />
            <p className="project-progress-note">{String(p.progress_source || '').startsWith('github:') ? `GitHub structure estimate · ${String(p.progress_source).slice(7).replace(/,/g, ' · ') || 'repo checked'} · ${p.progress_checked_at ? new Date(p.progress_checked_at).toLocaleString() : 'syncing now'}` : p.repository_url ? 'GitHub sync pending' : 'Add a public GitHub link for automatic progress estimates.'}</p>
            <div className="project-card-actions"><button className="secondary" onClick={() => editProject(p)}>Edit project</button><button className="secondary" onClick={() => void toggleProjectCompletion(p)}>{p.status === 'completed' ? 'Reopen project' : 'Mark project complete'}</button>{p.repository_url && <button className="primary" disabled={Boolean(syncing[p.id])} onClick={() => void syncProject(p)}>{syncing[p.id] ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {syncing[p.id] ? 'Checking…' : 'Refresh estimate'}</button>}</div>
          </Panel>
        ))}
      </div>
      {!c.records.projects.length && (
        <Panel>
          <h3>No projects yet</h3>
          <p>Create a project to start tracking your work in Kariqo.</p>
          <button className="secondary" onClick={() => { setEditingProject(null); setOpen(true); }} style={{ marginTop: '12px' }}>
            Create project
          </button>
        </Panel>
      )}
      {open && (
        <EditorDialog title={editingProject ? 'Edit project' : 'Create a project'} busy={busy} onClose={() => { setOpen(false); setEditingProject(null); }} onSubmit={saveProject}>
          <label>
            Project name
            <input name="title" defaultValue={editingProject?.title || ''} placeholder="e.g. Portfolio website, REST API Server" required autoFocus />
          </label>
          <label>
            What are you building?
            <textarea name="description" defaultValue={editingProject?.description || ''} rows={4} placeholder="What problem does it solve? What did you build?" />
          </label>
          <label>Public GitHub repository URL<input name="repository_url" type="url" defaultValue={editingProject?.repository_url || ''} placeholder="https://github.com/username/project" /><small>Public repositories only. GitHub structure gives an estimate, not verified feature completion.</small></label>
          <label>Live project/demo URL<input name="demo_url" type="url" defaultValue={editingProject?.demo_url || ''} placeholder="https://your-project.example" /><small>Optional link reviewers can open to try your project.</small></label>
        </EditorDialog>
      )}
    </>
  );
}

function Passport({ c }: { c: Ctx }) {
  const p = c.records.profile;
  const [readinessBusy, setReadinessBusy] = useState(false);
  const completedProjects = c.records.projects.filter((project) => project.status === 'completed');
  const hasRoadmap = c.records.roadmaps.length > 0;
  const score = readinessScore(c.records);
  const interviewReady = Boolean(p.learning_complete && p.interview_ready && hasRoadmap && completedProjects.length > 0 && score >= 70);
  const resumeText = [
    c.user.toUpperCase(),
    c.email,
    [p.course, p.college].filter(Boolean).join(' | '),
    '',
    'CAREER OBJECTIVE',
    p.career_goal || c.goal || 'Early-career candidate seeking an opportunity to learn and contribute.',
    '',
    'PROFESSIONAL SUMMARY',
    p.bio || `Interview-ready candidate focused on ${p.career_goal || c.goal || 'building practical skills'} with hands-on project experience.`,
    '',
    'SKILLS',
    ...c.records.skills.map((skill) => `${skill.name} (${skill.score}% self-assessed)`),
    '',
    'PROJECT EXPERIENCE',
    ...completedProjects.flatMap((project) => [project.title, project.description || 'Completed portfolio project.', '']),
    'LEARNING',
    'Completed Kariqo learning roadmap and interview preparation.',
  ].filter((line) => line !== undefined).join('\n').trim();

  const saveReadiness = async (patch: Record<string, unknown>) => {
    setReadinessBusy(true);
    try {
      await c.saveProfile(patch);
      c.say('Interview readiness saved', 'success');
    } catch (error) {
      c.say(dbMessage(error, 'Could not save interview readiness'), 'error');
    } finally {
      setReadinessBusy(false);
    }
  };

  const buildResume = async () => {
    if (!interviewReady) return;
    setReadinessBusy(true);
    try {
      await c.saveProfile({ ats_resume_text: resumeText });
      const file = new Blob([resumeText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${c.user.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'kariqo'}-ats-resume.txt`;
      link.click();
      URL.revokeObjectURL(url);
      c.say('ATS-friendly resume created and downloaded', 'success');
    } catch (error) {
      c.say(dbMessage(error, 'Could not create ATS resume'), 'error');
    } finally {
      setReadinessBusy(false);
    }
  };

  const print = () => {
    const bridge = (window as Window & { webkit?: { messageHandlers?: { printPassport?: { postMessage: (value: unknown) => void } } } })
      .webkit?.messageHandlers?.printPassport;
    if (bridge) bridge.postMessage('print');
    else window.print();
  };

  return (
    <>
      <Head
        tag="YOUR WORK, VERIFIED"
        title="Skill Passport"
        desc="A personal snapshot of your profile, skills, and projects."
        action={
          <button className="primary" onClick={print}>
            <ArrowRight size={16} /> Print passport
          </button>
        }
      />
      <div className="passport-print">
        <Panel className="passport-card">
          <div className="pass-head">
            <b>✳ KARIQO · BRAIN STROM</b>
            <small>SKILL PASSPORT</small>
          </div>
          <div className="pass-user">
            <Avatar user={c.user} photo={c.photo} />
            <div>
              <h2>{c.user}</h2>
              <p>
                {p.course || ''} {p.college ? '· ' + p.college : ''}
              </p>
              <small>{p.career_goal || 'Career goal not set'}</small>
            </div>
          </div>
          <p>{p.bio || 'Add a short profile description in Profile & Settings to introduce yourself.'}</p>
          <div className="pass-stats">
            <b>
              {c.records.skills.length}
              <small>Skills</small>
            </b>
            <b>
              {c.records.projects.length}
              <small>Projects</small>
            </b>
            <b>
              {c.records.projects.filter((x) => x.status === 'completed').length}
              <small>Completed</small>
            </b>
          </div>
          <div className="tags">
            {c.records.skills.map((k) => (
              <i key={k.id}>
                {k.name} · {k.score}%
              </i>
            ))}
          </div>
          <h3>Projects</h3>
          {c.records.projects.length ? (
            c.records.projects.map((pr) => (
              <p className="passport-project" key={pr.id}>
                <b>{pr.title}</b> · {pr.progress}%
                <br />
                {pr.description}
              </p>
            ))
          ) : (
            <p>No projects shared yet.</p>
          )}
        </Panel>
      </div>
      <Panel className="ats-readiness">
        <div className="ats-heading"><span className="ats-icon"><FileText size={18} /></span><div><small>CAREER PASSPORT ADD-ON</small><h2>ATS-friendly resume</h2><p>Unlock it when your learning plan is complete and you are ready for interviews.</p></div></div>
        <div className="readiness-score-card"><div><small>CAREER READINESS</small><b>{score}<span>/100</span></b></div><Progress value={score} /><p>{score >= 70 ? 'Readiness score reached. Finish the checklist below to unlock your ATS resume.' : `Reach 70 to unlock. Build skills, finish projects, practise interviews, and complete your profile.`}</p></div>
        <div className="ats-checklist">
          <div className={hasRoadmap ? 'ready' : ''}><span>{hasRoadmap ? <Check size={14} /> : '1'}</span><div><b>Learning roadmap</b><small>{hasRoadmap ? 'Your Kariqo study plan is saved' : 'Generate an AI Roadmap to start'}</small></div></div>
          <div className={completedProjects.length ? 'ready' : ''}><span>{completedProjects.length ? <Check size={14} /> : '2'}</span><div><b>Portfolio project</b><small>{completedProjects.length ? `${completedProjects.length} project${completedProjects.length > 1 ? 's' : ''} completed` : 'Finish at least one project in Projects'}</small></div></div>
          <label className={p.learning_complete ? 'ready' : ''}><input type="checkbox" checked={Boolean(p.learning_complete)} disabled={readinessBusy || !hasRoadmap} onChange={(event) => void saveReadiness({ learning_complete: event.target.checked, ...(!event.target.checked ? { recruiter_visible: false } : {}) })} /><span>{p.learning_complete ? <Check size={14} /> : '3'}</span><div><b>I have completed my roadmap study</b><small>Confirm only after finishing the learning activities.</small></div></label>
          <label className={p.interview_ready ? 'ready' : ''}><input type="checkbox" checked={Boolean(p.interview_ready)} disabled={readinessBusy || !hasRoadmap || !completedProjects.length || score < 70} onChange={(event) => void saveReadiness({ interview_ready: event.target.checked, ...(!event.target.checked ? { recruiter_visible: false } : {}) })} /><span>{p.interview_ready ? <Check size={14} /> : '4'}</span><div><b>I have practised and am ready for interviews</b><small>{score < 70 ? 'Reach 70 readiness points first.' : 'Confirm your interview preparation is complete.'}</small></div></label>
        </div>
        {!interviewReady ? <div className="ats-locked"><LockKeyhole size={16} /><div><b>Resume locked</b><small>Complete all four readiness steps to unlock your ATS resume.</small></div></div> : <div className="ats-unlocked"><div><b><Check size={15} /> Interview-ready · ATS resume unlocked</b><small>Download a clean, single-column text resume that applicant tracking systems can read.</small></div><button className="primary" onClick={() => void buildResume()} disabled={readinessBusy}><FileText size={15} />{readinessBusy ? 'Saving…' : p.ats_resume_text ? 'Update & download resume' : 'Create ATS resume'}</button></div>}
        {interviewReady && Boolean(p.ats_resume_text) && <label className="recruiter-consent"><input type="checkbox" checked={Boolean(p.recruiter_visible)} disabled={readinessBusy} onChange={(event) => void saveReadiness({ recruiter_visible: event.target.checked })} /><span><b>Share my profile and ATS resume with approved companies</b><small>Companies can see your name, email, course, skills, completed project summary, and resume for jobs that match your skills. Turn this off any time.</small></span></label>}
      </Panel>
    </>
  );
}

function JobOffers({ c }: { c: Ctx }) {
  const [busyOffer, setBusyOffer] = useState('');
  const passport = c.records.profile;
  const completedProjects = c.records.projects.filter((project) => project.status === 'completed').length;
  const readiness = [
    { label: 'Study roadmap completed', done: Boolean(passport.learning_complete) },
    { label: 'Portfolio project completed', done: completedProjects > 0 },
    { label: 'Interview-ready status confirmed', done: Boolean(passport.interview_ready) },
    { label: 'Company sharing enabled', done: Boolean(passport.recruiter_visible) },
  ];
  const trackOffer = async (offer: Record<string, any>) => {
    if (!supabase) return;
    const { error } = await supabase.from('skillvo_job_applications').upsert({ student_id: c.userId, source_key: `offer:${offer.id}`, job_title: offer.job_title || 'Company role', company_name: offer.company_name || '', status: 'offer' }, { onConflict: 'student_id,source_key', ignoreDuplicates: true });
    if (error) return c.say(dbMessage(error, 'Could not track this offer'), 'error');
    await c.refresh(); c.say('Offer added to your application tracker', 'success'); c.setPage('Applications');
  };
  const respondToOffer = async (offer: Record<string, any>, status: 'accepted' | 'declined') => {
    if (!supabase) return;
    setBusyOffer(offer.id);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'respond-offer', offerId: offer.id, status } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not respond to this offer'));
      if (data?.error) throw new Error(data.error);
      await c.refresh();
      c.say(data?.message || 'Offer response saved', 'success');
    } catch (error) { c.say(dbMessage(error, 'Could not respond to this offer'), 'error'); }
    finally { setBusyOffer(''); }
  };
  return <>
    <Head tag="FROM APPROVED COMPANIES" title="Job offers & interview invites" desc="Offers sent to your Kariqo account by companies looking for your skills." />
    {c.records.jobOffers.length ? <div className="job-offer-list">{c.records.jobOffers.map((offer) => <Panel className="job-offer-card" key={offer.id}><div className="job-offer-mark"><BriefcaseBusiness size={19} /></div><div className="job-offer-main"><small>{offer.company_name || 'Kariqo employer'} · {new Date(offer.created_at).toLocaleDateString()}</small><h2>{offer.job_title || 'Job opportunity'}</h2><p>{offer.job_location || 'Location shared by the company'} · {offer.match_score}% skill match</p><span className={`owner-status ${offer.status === 'sent' ? 'active' : offer.status}`}>{offer.status === 'sent' ? 'Waiting for your response' : offer.status}</span></div>{offer.status === 'sent' ? <div className="offer-response-actions"><button className="primary" onClick={() => void respondToOffer(offer, 'accepted')} disabled={Boolean(busyOffer)}>{busyOffer === offer.id ? 'Saving…' : 'Accept offer'}</button><button className="secondary" onClick={() => void respondToOffer(offer, 'declined')} disabled={Boolean(busyOffer)}>Decline</button></div> : <button className="secondary" onClick={() => void trackOffer(offer)}>View in tracker</button>}</Panel>)}</div> : <Panel className="job-offers-empty discovery-empty">
      <div className="discovery-empty-art offers-art"><BriefcaseBusiness size={25} /><span><Sparkles size={15} /></span></div>
      <div className="discovery-empty-copy"><small>YOUR NEXT OPPORTUNITY</small><h2>No company offers yet</h2><p>Offers appear here when an approved company finds your profile and sends an invite. Get your Skill Passport ready so your skills and project proof are visible to recruiters.</p></div>
      <div className="offer-readiness">{readiness.map((item) => <div className={item.done ? 'done' : ''} key={item.label}><span>{item.done ? <Check size={12} /> : <LockKeyhole size={11} />}</span>{item.label}</div>)}</div>
      <div className="discovery-empty-actions"><button className="primary" onClick={() => c.setPage('Opportunities')}>Browse job opportunities <ArrowRight size={14} /></button><button className="secondary" onClick={() => c.setPage('Skill Passport')}>Prepare Skill Passport</button><button className="secondary" onClick={() => void c.refresh()}>Refresh offers</button></div>
    </Panel>}
  </>;
}

function Opportunities({ c }: { c: Ctx }) {
  const [filter, setFilter] = useState('All');
  const [companyJobs, setCompanyJobs] = useState<Record<string, any>[]>([]);
  const [simulations, setSimulations] = useState<Record<string, any>[]>([]);
  const [simulationSubmissions, setSimulationSubmissions] = useState<Record<string, any>[]>([]);
  const [simulationDrafts, setSimulationDrafts] = useState<Record<string, { answer: string; url: string }>>({});
  const [submittingSimulation, setSubmittingSimulation] = useState('');
  const [jobsLoading, setJobsLoading] = useState(false);
  const [applyingJob, setApplyingJob] = useState('');
  const rows = c.records.opportunities.filter((o) => filter === 'All' || o.kind?.toLowerCase() === filter.toLowerCase());

  const loadCompanyJobs = async () => {
    if (!supabase) return;
    setJobsLoading(true);
    const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'list-jobs' } });
    if (error) c.say(await functionErrorMessage(error, 'Company jobs could not load'), 'error');
    else if (data?.error) c.say(data.error, 'error');
    else setCompanyJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    const { data: simulationData, error: simulationError } = await supabase.functions.invoke('company-dashboard', { body: { action: 'list-public-simulations' } });
    if (simulationError) c.say(await functionErrorMessage(simulationError, 'Company work simulations could not load'), 'error');
    else if (simulationData?.error) c.say(simulationData.error, 'error');
    else {
      setSimulations(Array.isArray(simulationData?.simulations) ? simulationData.simulations : []);
      setSimulationSubmissions(Array.isArray(simulationData?.mySubmissions) ? simulationData.mySubmissions : []);
    }
    setJobsLoading(false);
  };

  useEffect(() => { void loadCompanyJobs(); }, []);

  const save = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('opportunity_saves').upsert({ user_id: c.userId, opportunity_id: id });
    c.say(error ? error.message : 'Opportunity saved to your account', error ? 'error' : 'success');
  };

  const track = async (opportunity: Record<string, any>) => {
    if (!supabase || !c.userId) return;
    const { error } = await supabase.from('skillvo_job_applications').upsert({
      student_id: c.userId,
      source_key: `opportunity:${opportunity.id}`,
      job_title: opportunity.title,
      company_name: opportunity.organization || '',
      apply_url: opportunity.apply_url || '',
      status: 'saved',
    }, { onConflict: 'student_id,source_key', ignoreDuplicates: true });
    if (error) return c.say(dbMessage(error, 'Could not track this opportunity'), 'error');
    await c.refresh();
    c.say('Added to your application tracker', 'success');
    c.setPage('Applications');
  };

  const applyToExternalOpportunity = async (opportunity: Record<string, any>) => {
    if (!supabase || !c.userId) return;
    if (opportunity.apply_url) window.open(opportunity.apply_url, '_blank', 'noopener,noreferrer');
    const { error } = await supabase.from('skillvo_job_applications').upsert({
      student_id: c.userId,
      source_key: `opportunity:${opportunity.id}`,
      job_title: opportunity.title,
      company_name: opportunity.organization || '',
      apply_url: opportunity.apply_url || '',
      status: opportunity.apply_url ? 'applied' : 'saved',
    }, { onConflict: 'student_id,source_key', ignoreDuplicates: true });
    if (error) return c.say(dbMessage(error, 'Could not track this application'), 'error');
    await c.refresh();
    c.say(opportunity.apply_url ? 'Application opened and added to your tracker' : 'Opportunity saved to your application tracker', 'success');
    c.setPage('Applications');
  };

  const applyForCompanyJob = async (job: Record<string, any>) => {
    if (!supabase) return;
    setApplyingJob(job.id);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'apply-job', jobId: job.id } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not submit your application'));
      if (data?.error) throw new Error(data.error);
      await c.refresh();
      c.say(data?.message || 'Application sent', 'success');
    } catch (error) { c.say(dbMessage(error, 'Could not submit your application'), 'error'); }
    finally { setApplyingJob(''); }
  };

  const submitSimulation = async (simulation: Record<string, any>) => {
    if (!supabase) return;
    const draft = simulationDrafts[simulation.id] || { answer: '', url: '' };
    setSubmittingSimulation(simulation.id);
    try {
      const { data, error } = await supabase.functions.invoke('company-dashboard', { body: { action: 'submit-simulation', simulationId: simulation.id, answer: draft.answer, projectUrl: draft.url } });
      if (error) throw new Error(await functionErrorMessage(error, 'Could not submit this task'));
      if (data?.error) throw new Error(data.error);
      c.say(data?.message || 'Company task submitted', 'success');
      const { data: updated } = await supabase.functions.invoke('company-dashboard', { body: { action: 'list-public-simulations' } });
      setSimulationSubmissions(updated?.mySubmissions || []);
    } catch (error) { c.say(dbMessage(error, 'Could not submit this task'), 'error'); }
    finally { setSubmittingSimulation(''); }
  };

  return (
    <>
      <Head tag="YOUR NEXT CHAPTER" title="Opportunity hub" desc="Published opportunities from the Kariqo team." />
      <div className="filters">
        {['All', 'Internship', 'Challenge', 'Project'].map((x) => (
          <button className={x === filter ? 'chosen' : ''} onClick={() => setFilter(x)} key={x}>
            {x}
          </button>
        ))}
      </div>
      <div className="opps">
        {rows.map((o) => (
          <Panel className="opportunity" key={o.id}>
            <div className="org-logo">{o.organization?.slice(0, 1) || 'S'}</div>
            <div>
              <small>
                {o.kind} · {o.location}
              </small>
              <h3>{o.title}</h3>
              <p>{o.organization}</p>
              <p>{o.description}</p>
              <div className="tags">
                {(o.skills || []).map((t: string) => (
                  <i key={t}>{t}</i>
                ))}
              </div>
            </div>
            <button className="secondary" onClick={() => save(o.id)}>
              Save <ArrowRight size={14} />
            </button>
            <button className="secondary" onClick={() => void track(o)}>Track</button>
            <button className="primary" onClick={() => void applyToExternalOpportunity(o)}>{o.apply_url ? 'Apply & track' : 'Track this role'} <ArrowRight size={14} /></button>
          </Panel>
        ))}
      </div>
      <section className="company-opportunities">
        <div className="company-opportunities-head"><div><small>HIRING FROM APPROVED COMPANIES</small><h2>Company job openings</h2><p>Apply directly to roles posted in Kariqo.</p></div><button className="secondary" onClick={() => void loadCompanyJobs()} disabled={jobsLoading}><RefreshCw size={14} /> Refresh</button></div>
        {jobsLoading ? <Panel className="company-jobs-empty">Loading company openings…</Panel> : companyJobs.length ? <div className="company-openings-grid">{companyJobs.map((job) => {
          const applied = c.records.applications.some((application) => application.company_job_id === job.id || application.source_key === `company-job:${job.id}`);
          return <Panel className="company-opening-card" key={job.id}><small>{job.company_name} · {job.job_type || 'Role'}</small><h3>{job.title}</h3><p>{job.location || 'Location shared after application'}</p><p>{job.description || 'Company is looking for candidates with these skills.'}</p><div className="tags">{(job.required_skills || []).map((skill: string) => <i key={skill}>{skill}</i>)}</div><button className={applied ? 'secondary' : 'primary'} onClick={() => void applyForCompanyJob(job)} disabled={applied || Boolean(applyingJob)}>{applied ? 'Application sent' : applyingJob === job.id ? 'Applying…' : 'Apply in Kariqo'} {!applied && <ArrowRight size={14} />}</button></Panel>;
        })}</div> : <Panel className="company-jobs-empty"><BriefcaseBusiness size={18} /><div><b>No company roles posted yet</b><p>Approved companies’ open roles will show here when they publish them.</p></div></Panel>}
      </section>
      <section className="company-opportunities company-work-simulations"><div className="company-opportunities-head"><div><small>SHOW YOUR WORK · GET REAL FEEDBACK</small><h2>Company work simulations</h2><p>Try a sample task tied to a real role and submit your approach with project evidence.</p></div><button className="secondary" onClick={() => void loadCompanyJobs()} disabled={jobsLoading}><RefreshCw size={14} /> Refresh</button></div>
        {simulations.length ? <div className="company-openings-grid">{simulations.map((simulation) => { const existing = simulationSubmissions.find((item) => item.simulation_id === simulation.id); const draft = simulationDrafts[simulation.id] || { answer: '', url: '' }; return <Panel className="company-opening-card company-simulation-student-card" key={simulation.id}><small>{simulation.company_name} · {simulation.job_title} {simulation.deadline ? `· Due ${new Date(simulation.deadline).toLocaleString()}` : ''}</small><h3>{simulation.title}</h3><p>{simulation.instructions}</p><div className="tags">{(simulation.expected_skills || []).map((skill: string) => <i key={skill}>{skill}</i>)}</div>{existing ? <div className="simulation-student-status"><Check size={14} /><span><b>Submitted · {existing.status}</b>{existing.score !== null && existing.score !== undefined && <small>Company review score: {existing.score}/100</small>}{existing.feedback && <small>{existing.feedback}</small>}</span></div> : <><label className="simulation-answer-label">Your approach and result<textarea rows={4} minLength={20} maxLength={8000} value={draft.answer} onChange={(event) => setSimulationDrafts((old) => ({ ...old, [simulation.id]: { ...draft, answer: event.target.value } }))} placeholder="Explain how you approached the task, decisions you made, and what you found…" /></label><label className="simulation-answer-label">Project or evidence link (optional)<input type="url" value={draft.url} onChange={(event) => setSimulationDrafts((old) => ({ ...old, [simulation.id]: { ...draft, url: event.target.value } }))} placeholder="https://github.com/you/project" /></label><button className="primary" onClick={() => void submitSimulation(simulation)} disabled={Boolean(submittingSimulation) || draft.answer.trim().length < 20}>{submittingSimulation === simulation.id ? 'Submitting…' : 'Submit work for review'} <ArrowRight size={14} /></button></>}</Panel>; })}</div> : <Panel className="company-jobs-empty"><Target size={18} /><div><b>No company tasks posted yet</b><p>Work simulations from approved companies will appear here.</p></div></Panel>}
      </section>
      {!rows.length && !companyJobs.length && !simulations.length && (
        <Panel className="discovery-empty opportunity-empty">
          <div className="discovery-empty-art opp-art"><Compass size={25} /><span><Sparkles size={15} /></span></div>
          <div className="discovery-empty-copy"><small>{filter === 'All' ? 'FRESH PATHS ARE ON THE WAY' : `${filter.toUpperCase()}S`}</small><h2>{filter === 'All' ? 'No opportunities published yet' : `No ${filter.toLowerCase()}s here yet`}</h2><p>{filter === 'All' ? 'New internships, challenges and projects will show up here when the Kariqo team publishes them. Keep building your roadmap and portfolio while you wait.' : `There are no ${filter.toLowerCase()} listings right now. Pick another category to explore, or check back after new listings are published.`}</p></div>
          <div className="discovery-empty-actions">{filter !== 'All' && <button className="secondary" onClick={() => setFilter('All')}>Show all opportunities</button>}<button className="primary" onClick={() => c.setPage('AI Roadmap')}>Continue my roadmap <ArrowRight size={14} /></button><button className="secondary" onClick={() => void c.refresh()}>Refresh listings</button></div>
        </Panel>
      )}
    </>
  );
}

function Applications({ c }: { c: Ctx }) {
  const stages = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];
  const updateStage = async (row: Record<string, any>, status: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('skillvo_job_applications').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id).eq('student_id', c.userId);
    if (error) return c.say(dbMessage(error, 'Could not update application'), 'error');
    await c.refresh();
    c.say('Application stage updated', 'success');
  };
  return <>
    <Head tag="YOUR JOB SEARCH" title="Application tracker" desc="Keep your saved roles, interviews, and offers in one private place." />
    <div className="application-summary metrics">{['saved', 'applied', 'interview', 'offer'].map((stage) => <Panel className="metric" key={stage}><span>{stage === 'interview' ? 'Interviews' : `${stage[0].toUpperCase()}${stage.slice(1)}`}</span><b>{c.records.applications.filter((row) => row.status === stage).length}</b></Panel>)}</div>
    {c.records.applications.length ? <div className="application-list">{c.records.applications.map((row) => <Panel className="application-card" key={row.id}>
      <div><small>{row.company_name || 'Company'}{row.updated_at ? ` · Updated ${new Date(row.updated_at).toLocaleDateString()}` : ''}</small><h2>{row.job_title}</h2>{row.apply_url && <a href={row.apply_url} target="_blank" rel="noreferrer">Open job listing <ArrowRight size={13} /></a>}</div>
      <label>Stage<select value={row.status} onChange={(event) => void updateStage(row, event.target.value)}>{stages.map((stage) => <option key={stage} value={stage}>{stage[0].toUpperCase() + stage.slice(1)}</option>)}</select></label>
    </Panel>)}</div> : <Panel className="discovery-empty"><div className="discovery-empty-art offers-art"><BriefcaseBusiness size={25} /></div><div className="discovery-empty-copy"><small>ONE PLACE FOR YOUR JOB SEARCH</small><h2>No roles tracked yet</h2><p>Track an opportunity or add a company role here, then update it as you apply, interview, or receive an offer.</p></div><div className="discovery-empty-actions"><button className="primary" onClick={() => c.setPage('Opportunities')}>Browse opportunities <ArrowRight size={14} /></button></div></Panel>}
  </>;
}

function Mentor({ c }: { c: Ctx }) {
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [chatMentor, setChatMentor] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);

  if (!c.membershipActive) return <MembershipGate c={c} feature="mentor" />;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase || !selected) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const note = String(f.get('note')).trim();
    const date = String(f.get('starts_at'));
    const starts_at = new Date(date);

    if (!note) return c.say('Add a short note for the mentor', 'error');
    if (!date || Number.isNaN(starts_at.getTime()) || starts_at.getTime() <= Date.now()) return c.say('Choose a future date and time', 'error');

    setBusy(true);
    try {
      const { error } = await supabase.from('mentor_sessions').insert({
        user_id: c.userId,
        mentor_id: selected.id,
        starts_at: starts_at.toISOString(),
        note,
      });
      if (error) throw error;
      setSelected(null);
      c.say('Mentor request sent', 'success');
    } catch (e) {
      c.say(dbMessage(e, 'Could not send mentor request'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const suggestedDate = new Date(Date.now() + 7 * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <>
      <Head tag="GUIDANCE THAT MOVES YOU FORWARD" title="Mentor connect" desc="Browse mentors who have published a profile for Kariqo students." />
      <div className="cards three">
        {c.records.mentors.map((m) => (
          <Panel className="mentor-card" key={m.id}>
            <div className="mentor-avatar">
              {m.full_name
                .split(' ')
                .map((s: string) => s[0])
                .slice(0, 2)
                .join('')}
            </div>
            <h3>{m.full_name}</h3>
            <p>{m.title}</p>
            <p>{m.bio}</p>
            <div className="tags">
              {(m.expertise || []).map((x: string) => (
                <i key={x}>{x}</i>
              ))}
            </div>
            <div className="mentor-card-actions">
              <button className="secondary" onClick={() => setChatMentor(m)}><MessageCircle size={14} /> Message mentor</button>
              <button className="primary" onClick={() => setSelected(m)}>Request a session <ArrowRight size={14} /></button>
            </div>
          </Panel>
        ))}
      </div>
      {!c.records.mentors.length && (
        <Panel className="mentor-directory-empty">
          <h3>No published mentor profiles yet</h3>
          <p>Mentors appear here after they publish a directory profile. If one was just published, refresh this list.</p>
          <button className="secondary" onClick={() => void c.refresh()}><RefreshCw size={14} /> Refresh mentor list</button>
        </Panel>
      )}
      {selected && (
        <EditorDialog title={`Request a session with ${selected.full_name}`} busy={busy} onClose={() => setSelected(null)} onSubmit={submit}>
          <label>
            Preferred date and time
            <input name="starts_at" type="datetime-local" min={minDate} defaultValue={suggestedDate} required />
          </label>
          <label>
            What would you like to discuss?
            <textarea name="note" rows={4} placeholder="Share a short note for the mentor" required autoFocus />
          </label>
        </EditorDialog>
      )}
      {chatMentor && <MentorChatDialog mentor={chatMentor} studentId={c.userId} studentName={c.records.profile.full_name || c.user} onClose={() => setChatMentor(null)} say={c.say} />}
    </>
  );
}

function MentorChatDialog({ mentor, studentId, studentName, initialThread, viewerIsMentor = false, onClose, say }: {
  mentor: Record<string, any>;
  studentId: string;
  studentName: string;
  initialThread?: Record<string, any> | null;
  viewerIsMentor?: boolean;
  onClose: () => void;
  say: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [messages, setMessages] = useState<Record<string, any>[]>([]);
  const [thread, setThread] = useState<Record<string, any> | null>(initialThread || null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadMessages = async (knownThread?: Record<string, any> | null) => {
    if (!supabase) { setLoading(false); return; }
    let activeThread = knownThread || thread;
    if (!activeThread && !viewerIsMentor) {
      const { data, error } = await supabase.from('mentor_doubt_threads').select('*').eq('mentor_id', mentor.id).eq('student_id', studentId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) say(`Could not load this conversation: ${error.message}`, 'error');
      activeThread = data || null;
    }
    if (!activeThread) { setMessages([]); setLoading(false); return; }
    setThread(activeThread);
    const { data, error } = await supabase.from('mentor_doubt_messages').select('*').eq('thread_id', activeThread.id).order('created_at');
    if (error) say(`Could not load this conversation: ${error.message}`, 'error');
    else {
      const firstMessage = activeThread.initial_message ? [{ id: `initial-${activeThread.id}`, thread_id: activeThread.id, sender_id: activeThread.student_id, body: activeThread.initial_message, created_at: activeThread.created_at }] : [];
      setMessages([...firstMessage, ...(data || [])]);
    }
    setLoading(false);
  };
  useEffect(() => {
    void loadMessages(initialThread);
    const timer = window.setInterval(() => void loadMessages(initialThread), 5000);
    return () => window.clearInterval(timer);
  }, [mentor.id, studentId, initialThread?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !supabase || sending) return;
    setSending(true);
    if (thread) {
      const { error } = await supabase.from('mentor_doubt_messages').insert({ thread_id: thread.id, sender_id: viewerIsMentor ? mentor.user_id : studentId, body });
      setSending(false);
      if (error) return say(`Could not send message: ${error.message}`, 'error');
      setDraft('');
      await loadMessages(thread);
    } else {
      const { data, error } = await supabase.from('mentor_doubt_threads').insert({ student_id: studentId, mentor_id: mentor.id, subject: body.slice(0, 80), initial_message: body }).select('*').single();
      setSending(false);
      if (error) return say(`Could not start this conversation: ${error.message}`, 'error');
      setDraft('');
      await loadMessages(data);
    }
  };
  return <div className="mentor-chat-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="mentor-chat-dialog" role="dialog" aria-modal="true" aria-label={`Message ${mentor.full_name}`}>
      <header><span className="mentor-chat-avatar">{String(viewerIsMentor ? studentName : mentor.full_name || 'M').split(' ').map((part: string) => part[0]).slice(0, 2).join('')}</span><span><b>{viewerIsMentor ? studentName : mentor.full_name}</b><small>{viewerIsMentor ? `Student · ${mentor.title || 'Mentor'}` : mentor.title || 'Mentor'}</small></span><button className="secondary" onClick={onClose} aria-label="Close conversation"><X size={15} /></button></header>
      <div className="mentor-chat-messages">
        {loading ? <p className="mentor-chat-empty">Loading conversation…</p> : messages.length ? messages.map((message) => <article className={(viewerIsMentor ? message.sender_id === mentor.user_id : message.sender_id === studentId) ? 'mentor-chat-bubble mine' : 'mentor-chat-bubble'} key={message.id}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></article>) : <div className="mentor-chat-empty"><MessageCircle size={22} /><b>Ask your mentor a question</b><span>Use this private chat to clear a doubt when you can’t connect live.</span></div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={(event) => void sendMessage(event)}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={3000} rows={2} placeholder="Type your doubt or reply…" aria-label="Message" /><button className="primary" disabled={!draft.trim() || sending}>{sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}<span>{sending ? 'Sending…' : 'Send'}</span></button></form>
    </section>
  </div>;
}

function Classes({ c }: { c: Ctx }) {
  const [activeRoom, setActiveRoom] = useState<{ id: string; title: string } | null>(null);
  const [myRegistrations, setMyRegistrations] = useState<Record<string, any>[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [studentMaterials, setStudentMaterials] = useState<Record<string, any>[]>([]);
  const [studentClassNotes, setStudentClassNotes] = useState<Record<string, any>[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<Record<string, any>[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Record<string, any>[]>([]);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const loadMyAttendance = async () => {
    if (!supabase) { setAttendanceLoading(false); return; }
    setAttendanceLoading(true);
    const { data, error } = await supabase.from('class_registrations')
      .select('class_id,attendance_status,attended_at,created_at').eq('user_id', c.userId).order('created_at', { ascending: false });
    if (error) c.say(`Could not load your class attendance: ${error.message}`, 'error');
    else setMyRegistrations(data || []);
    setAttendanceLoading(false);
  };
  const loadClassResources = async () => {
    if (!supabase || !c.records.classes.length) { setStudentMaterials([]); setStudentAssignments([]); setStudentSubmissions([]); setStudentClassNotes([]); return; }
    const classIds = c.records.classes.map((item) => item.id);
    const [materials, assignments, notes] = await Promise.all([
      supabase.from('mentor_class_materials').select('*').in('class_id', classIds).order('created_at', { ascending: false }),
      supabase.from('mentor_class_assignments').select('*').in('class_id', classIds).order('due_at'),
      supabase.from('mentor_class_notes').select('*').in('class_id', classIds),
    ]);
    if (notes.error) c.say(`Could not load class recaps: ${notes.error.message}`, 'error'); else setStudentClassNotes(notes.data || []);
    if (materials.error) c.say(`Could not load class materials: ${materials.error.message}`, 'error'); else setStudentMaterials(await addMaterialAccessUrls(materials.data || []));
    if (assignments.error) c.say(`Could not load assignments: ${assignments.error.message}`, 'error');
    else {
      setStudentAssignments(assignments.data || []);
      const ids = (assignments.data || []).map((assignment) => assignment.id);
      if (!ids.length) setStudentSubmissions([]);
      else {
        const { data, error } = await supabase.from('mentor_assignment_submissions').select('*').eq('student_id', c.userId).in('assignment_id', ids);
        if (error) c.say(`Could not load your submissions: ${error.message}`, 'error'); else setStudentSubmissions(data || []);
      }
    }
  };
  useEffect(() => { void loadMyAttendance(); void loadClassResources(); }, [c.userId, c.records.classes]);
  const submitAssignment = async (event: FormEvent<HTMLFormElement>, assignmentId: string) => {
    event.preventDefault(); if (!supabase) return;
    const form = new FormData(event.currentTarget); const submissionText = String(form.get('submission_text') || '').trim(); const submissionUrl = String(form.get('submission_url') || '').trim();
    if (!submissionText && !submissionUrl) return c.say('Write a short response or add a link to your work.', 'error');
    setSubmissionBusy(true);
    const { error } = await supabase.from('mentor_assignment_submissions').insert({ assignment_id: assignmentId, student_id: c.userId, submission_text: submissionText, submission_url: submissionUrl });
    setSubmissionBusy(false);
    if (error) return c.say(error.code === '23505' ? 'You already submitted this assignment.' : `Could not submit assignment: ${error.message}`, 'error');
    c.say('Assignment submitted to your mentor', 'success'); await loadClassResources();
  };
  const registrationByClass = new Map(myRegistrations.map((item) => [item.class_id, item]));
  const attendedCount = myRegistrations.filter((item) => ['present', 'late'].includes(item.attendance_status)).length;
  const markedSessions = myRegistrations.filter((item) => ['present', 'late', 'absent'].includes(item.attendance_status));
  const attendanceRate = markedSessions.length ? Math.round(attendedCount / markedSessions.length * 100) : 0;
  const attendanceStatusLabel: Record<string, string> = { not_marked: 'Waiting for mentor', present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
  const upcomingClasses = c.records.classes.filter((item) => new Date(item.starts_at).getTime() >= Date.now());
  return (
    <>
      <Head tag="LEARN TOGETHER" title="Live classes" desc="Attend live classes and keep track of your learning record." />
      <Panel className="student-attendance-panel">
        <div className="student-attendance-head"><div><small>YOUR LEARNING RECORD</small><h2>My class attendance</h2><p>Official attendance is marked by your mentor after each class.</p></div><button className="secondary" onClick={() => void loadMyAttendance()} disabled={attendanceLoading}><RefreshCw size={14} /> Refresh</button></div>
        <div className="student-attendance-metrics"><div><small>CLASSES ATTENDED</small><b>{attendanceLoading ? '—' : attendedCount}</b></div><div><small>ATTENDANCE RATE</small><b>{attendanceLoading ? '—' : `${attendanceRate}%`}</b></div><div><small>REGISTERED CLASSES</small><b>{attendanceLoading ? '—' : myRegistrations.length}</b></div></div>
        {attendanceLoading ? <p>Loading attendance…</p> : myRegistrations.length ? <div className="student-attendance-list">{myRegistrations.map((item) => {
          const classInfo = c.records.classes.find((classItem) => classItem.id === item.class_id);
          return <article key={item.class_id}><span><b>{classInfo?.title || 'Registered class'}</b><small>{classInfo ? new Date(classInfo.starts_at).toLocaleString() : new Date(item.created_at).toLocaleDateString()}</small></span><strong className={`student-attendance-status ${item.attendance_status || 'not_marked'}`}>{attendanceStatusLabel[item.attendance_status] || 'Waiting for mentor'}</strong></article>;
        })}</div> : <div className="student-attendance-empty">Register for a live class below to start your attendance record.</div>}
      </Panel>
      {!c.membershipActive && <MembershipGate c={c} feature="classes" />}
      {c.membershipActive && <div className="cards two">
        {c.records.classes.map((x) => {
          const startsAt = new Date(x.starts_at).getTime();
          const endsAt = startsAt + (Number(x.duration_minutes) || 60) * 60000;
          const classIsOver = Date.now() > endsAt;
          const canJoinClass = Date.now() >= startsAt - 10 * 60000 && !classIsOver;
          return <Panel className="event class-event" key={x.id}>
            <CalendarDays />
            <span>
              <small>{new Date(x.starts_at).toLocaleString()}</small>
              <h3>{x.title}</h3>
              <p>{x.description}</p>
              <p>
                {x.duration_minutes} minutes · {x.instructor}
              </p>
            </span>
            <div className="student-class-resources">
              {studentMaterials.filter((material) => material.class_id === x.id).map((material) => <a className="student-material-link" key={material.id} href={material.access_url || undefined} target="_blank" rel="noreferrer"><FileText size={13} /><span><b>{material.title}</b><small>{material.storage_path ? 'Uploaded class file' : material.resource_type}</small></span><ArrowRight size={13} /></a>)}
              {studentAssignments.filter((assignment) => assignment.class_id === x.id).map((assignment) => {
                const submission = studentSubmissions.find((item) => item.assignment_id === assignment.id);
                const registered = registrationByClass.has(x.id);
                return <article className="student-assignment-card" key={assignment.id}>
                  <div><b>{assignment.title}</b><small>{assignment.due_at ? `Due ${new Date(assignment.due_at).toLocaleString()}` : 'No due date'}</small></div>
                  {assignment.instructions && <p>{assignment.instructions}</p>}
                  {submission ? <div className="student-submission-result"><strong>Submitted · {new Date(submission.submitted_at).toLocaleDateString()}</strong>{submission.score !== null && submission.score !== undefined && <b>{submission.score}%</b>}{submission.feedback && <p>{submission.feedback}</p>}</div> : registered ? <form onSubmit={(event) => void submitAssignment(event, assignment.id)}><textarea name="submission_text" rows={2} maxLength={10000} placeholder="Write your response (optional if adding a work link)"/><input name="submission_url" type="url" maxLength={2048} placeholder="Link to your work (optional)"/><button className="primary student-submit-button" disabled={submissionBusy}>{submissionBusy ? 'Submitting…' : 'Submit assignment'} <ArrowRight size={14} /></button></form> : <small className="student-assignment-register-note">Register for this class to submit your work.</small>}
                </article>;
              })}
            </div>
            {registrationByClass.has(x.id) && classIsOver && <section className="student-class-recap">
              <div className="student-class-recap-heading"><span><FileText size={15} /></span><div><b>Class finished · Review & revise</b><small>Notes and materials from this session</small></div></div>
              {(() => {
                const recap = studentClassNotes.find((note) => note.class_id === x.id && note.published);
                return recap ? <><p>{recap.notes || 'Your mentor has not added written notes yet.'}</p>{recap.recording_url && <a className="secondary" href={recap.recording_url} target="_blank" rel="noopener noreferrer"><Video size={14} /> Watch class recording <ArrowRight size={13} /></a>}</>
                  : <p>Your mentor hasn’t published the recap yet. Class materials above are still available to review.</p>;
              })()}
            </section>}
            {registrationByClass.has(x.id) && Date.now() >= new Date(x.starts_at).getTime() && Date.now() <= new Date(x.starts_at).getTime() + (Number(x.duration_minutes) || 60) * 60000 && <ClassGazeCoach title={x.title} />}
            {registrationByClass.has(x.id) && canJoinClass && isSafeMeetingUrl(x.meeting_url)
              ? <a className="primary student-join-class" href={x.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={15} /> Join live class <ArrowRight size={14} /></a>
              : registrationByClass.has(x.id) && canJoinClass
                ? <button className="primary student-join-class" onClick={() => setActiveRoom({ id: x.id, title: x.title })}><Video size={15} /> Join in-app class <ArrowRight size={14} /></button>
                : registrationByClass.has(x.id) && <p className="class-join-status">{classIsOver ? 'Class ended' : `Join opens 10 minutes before · ${new Date(x.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</p>}
            <button
              className={registrationByClass.has(x.id) ? 'registered-class-button' : 'secondary'}
              disabled={registrationByClass.has(x.id) || startsAt < Date.now()}
              onClick={async () => {
                if (!supabase) return;
                const { error } = await supabase.from('class_registrations').insert({ user_id: c.userId, class_id: x.id });
                c.say(error && error.code !== '23505' ? error.message : error ? 'You are already registered for this class' : 'You are registered for this class', error && error.code !== '23505' ? 'error' : 'success');
                if (!error || error.code === '23505') await loadMyAttendance();
              }}
            >
              {registrationByClass.has(x.id) ? <>Registered <Check size={14} /></> : startsAt < Date.now() ? 'Class ended' : <>Register <ArrowRight size={14} /></>}
            </button>
          </Panel>;
        })}
      </div>}
      {c.membershipActive && !upcomingClasses.length && (
        <Panel>
          <h3>No upcoming classes</h3>
          <p>New published classes will appear here. You can still review your attendance history above.</p>
        </Panel>
      )}
      {activeRoom && <LiveClassRoom roomId={activeRoom.id} title={activeRoom.title} displayName={c.records.profile.full_name || c.user} onClose={() => setActiveRoom(null)} />}
    </>
  );
}

function LiveClassRoom({ roomId, title, displayName, isHost = false, onClose }: { roomId: string; title: string; displayName: string; isHost?: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState('Securely joining the class…');
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    let disposed = false;
    let api: JitsiExternalApi | undefined;
    let timeout: number | undefined;
    const fail = (message: string) => {
      if (disposed) return;
      window.clearTimeout(timeout);
      setStatus(message);
      setFailed(true);
    };
    const start = (meeting: { token: string; roomName: string; domain: string; externalApiUrl: string }) => {
      if (disposed || !containerRef.current) return;
      if (!window.JitsiMeetExternalAPI) return fail('The video room did not finish loading. Check your connection and retry.');
      try {
        api = new window.JitsiMeetExternalAPI(meeting.domain, {
          roomName: meeting.roomName,
          jwt: meeting.token,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName: displayName || 'Kariqo learner' },
          configOverwrite: { startWithAudioMuted: true, startWithVideoMuted: true, prejoinConfig: { enabled: true } },
        });
        api.addListener('videoConferenceJoined', () => { window.clearTimeout(timeout); setFailed(false); setStatus(isHost ? 'You’re hosting this live class. Camera and microphone start off; turn them on when ready.' : 'You’re in the live class. Camera and microphone start off; turn them on when you’re ready.'); });
        api.addListener('readyToClose', () => onCloseRef.current());
        timeout = window.setTimeout(() => fail('The video room is taking too long to connect. Check your connection or retry.'), 20000);
      } catch {
        fail('Could not open the video room. Please retry, or ask the mentor to share a meeting link.');
      }
    };
    const connect = async () => {
      setFailed(false);
      setStatus('Securely joining the class…');
      if (!supabase) { fail('Sign in to start this live class.'); return; }
      const { data, error } = await supabase.functions.invoke('jaas-meeting-token', { body: { classId: roomId } });
      if (disposed) return;
      if (error || !data?.token || !data?.roomName || !data?.externalApiUrl) {
        let message = data?.error || '';
        const context = (error as (typeof error & { context?: Response }) | null)?.context;
        if (!message && context && typeof context.clone === 'function') {
          try { message = (await context.clone().json())?.error || ''; } catch { /* The response may not contain JSON. */ }
        }
        fail(message || error?.message || 'Could not prepare the live class. Check your sign-in and try again.');
        return;
      }
      const meeting = data as { token: string; roomName: string; domain: string; externalApiUrl: string };
      timeout = window.setTimeout(() => fail('The video room is taking too long to connect. Check your connection or retry.'), 25000);
      if (window.JitsiMeetExternalAPI) return start(meeting);
      const existing = document.querySelector<HTMLScriptElement>('script[data-kariqo-jaas]');
      const script = existing || document.createElement('script');
      if (existing?.dataset.loadState === 'failed') { existing.remove(); }
      const activeScript = existing?.dataset.loadState === 'failed' ? document.createElement('script') : script;
      if (!existing || existing.dataset.loadState === 'failed') {
        activeScript.src = meeting.externalApiUrl;
        activeScript.async = true;
        activeScript.dataset.kariqoJaas = 'true';
        activeScript.dataset.loadState = 'loading';
        document.head.appendChild(activeScript);
      }
      activeScript.addEventListener('load', () => { activeScript.dataset.loadState = 'loaded'; start(meeting); }, { once: true });
      activeScript.addEventListener('error', () => { activeScript.dataset.loadState = 'failed'; fail('Could not reach the video service. Check your internet connection and retry.'); }, { once: true });
    };
    void connect().catch(() => fail('Could not start the live class. Check your sign-in and retry.'));
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      api?.dispose();
    };
  }, [roomId, displayName, isHost, attempt]);
  return <div className="live-room-shade" role="dialog" aria-modal="true" aria-label={`${title} live class`}>
    <section className="live-room-panel">
      <header><div><small>KARIQO LIVE CLASS</small><h2>{title}</h2><p role="status" aria-live="polite">{status}</p></div><div className="live-room-actions">{failed && <button className="secondary" onClick={() => { setStatus('Reconnecting to the live class…'); setAttempt((value) => value + 1); }}><RefreshCw size={14} /> Retry</button>}<button className="secondary" onClick={onClose} aria-label="Leave class"><X size={16} /> Leave</button></div></header>
      <div className="live-room-frame" ref={containerRef} />
      <footer>Audio and video are off when you join. Allow browser camera/microphone access only if you want to speak or show video.</footer>
    </section>
  </div>;
}

function isSafeMeetingUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function ClassGazeCoach({ title }: { title: string }) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('Camera is off. Kiko never starts it without your click.');
  const [nudge, setNudge] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let landmarker: { detectForVideo: (video: HTMLVideoElement, timestamp: number) => { faceLandmarks: { x: number; y: number }[][] }; close: () => void } | undefined;
    let frameId = 0;
    let lastSample = 0;
    let awaySince = 0;
    let nudged = false;
    let centeredSince = 0;
    let lastVideoTime = -1;
    const stopCamera = () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        setStatus('Paused because you left Kariqo. Camera is now off.');
        setNudge('Your class is still open. Kiko paused the camera while you were away.');
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Kiko · class focus', { body: `Your ${title} class is still open. The camera has been paused.` });
        }
        setActive(false);
      } else if (!stopped) {
        setNudge('Welcome back! Camera focus is paused; start it again if you want.');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const eyePosition = (points: { x: number; y: number }[], corners: [number, number], iris: number[]) => {
      const a = points[corners[0]], b = points[corners[1]];
      const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
      const irisX = iris.reduce((sum, index) => sum + points[index].x, 0) / iris.length;
      return (irisX - left) / Math.max(.0001, right - left);
    };
    const detect = (now: number) => {
      if (stopped) return;
      frameId = requestAnimationFrame(detect);
      const video = videoRef.current;
      if (!landmarker || !video || video.readyState < 2 || video.currentTime === lastVideoTime || now - lastSample < 700) return;
      lastSample = now;
      lastVideoTime = video.currentTime;
      try {
        const result = landmarker.detectForVideo(video, now);
        const points = result.faceLandmarks[0];
        if (!points) {
          if (!awaySince) awaySince = now;
          const seconds = Math.round((now - awaySince) / 1000);
          setStatus(seconds >= 12 ? 'Kiko noticed you may have stepped away.' : 'Face not clear — tracking this as a possible break.');
          if (seconds >= 12 && !nudged) {
            nudged = true;
            setNudge(`You’ve been away from ${title} for a little while. Take your time, then come back when you’re ready.`);
            if ('Notification' in window && Notification.permission === 'granted') new Notification('Kiko · gentle reminder', { body: `Your ${title} class is still open. Come back when you’re ready.` });
          }
          return;
        }
        const leftEye = eyePosition(points, [33, 133], [468, 469, 470, 471, 472]);
        const rightEye = eyePosition(points, [362, 263], [473, 474, 475, 476, 477]);
        const eyeVertical = (top: number, bottom: number, iris: number[]) => {
          const upper = points[top].y, lower = points[bottom].y;
          const irisY = iris.reduce((sum, index) => sum + points[index].y, 0) / iris.length;
          return (irisY - upper) / Math.max(.0001, lower - upper);
        };
        const leftVertical = eyeVertical(159, 145, [468, 469, 470, 471, 472]);
        const rightVertical = eyeVertical(386, 374, [473, 474, 475, 476, 477]);
        const lookingSideways = (leftEye < .24 && rightEye < .24) || (leftEye > .76 && rightEye > .76);
        const lookingUpDown = (leftVertical < .15 && rightVertical < .15) || (leftVertical > .85 && rightVertical > .85);
        const lookingAway = lookingSideways || lookingUpDown;
        if (lookingAway) {
          centeredSince = 0;
          if (!awaySince) awaySince = now;
          const seconds = Math.round((now - awaySince) / 1000);
          setStatus(seconds >= 12 ? 'Kiko noticed a longer look away.' : 'Tracking locally · approximate eye direction');
          if (seconds >= 12 && !nudged) {
            nudged = true;
            setNudge('Quick reset: your class is here when you’re ready. Brief breaks are okay.');
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Kiko · gentle reminder', { body: 'Your eyes seem away from the class for a little while. Ready to come back?' });
            }
          }
        } else {
          awaySince = 0;
          if (!centeredSince) centeredSince = now;
          if (now - centeredSince > 2500) { nudged = false; setNudge(''); }
          setStatus('Tracking locally · camera and lighting can affect accuracy.');
        }
      } catch {
        setStatus('Kiko could not read this camera frame. You can stop and try again.');
      }
    };
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable here. Open Kariqo on a secure https site or localhost.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }, audio: false });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        if (!videoRef.current) throw new Error('Camera preview is not ready.');
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('Loading on-device eye landmark model…');
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
          runningMode: 'VIDEO', numFaces: 1, minFaceDetectionConfidence: .6, minTrackingConfidence: .6,
        });
        if (!stopped) { setStatus('Tracking locally · approximate eye direction'); frameId = requestAnimationFrame(detect); }
      } catch (error) {
        if (!stopped) {
          const message = error instanceof Error ? error.message : 'Camera could not start.';
          setStatus(message.includes('Permission') || message.includes('denied') ? 'Camera permission was not granted. You can still attend without tracking.' : `Eye focus is unavailable: ${message}`);
          setActive(false);
        }
      }
    };
    void start();
    return () => { document.removeEventListener('visibilitychange', onVisibilityChange); stopCamera(); };
  }, [active, title]);

  useEffect(() => {
    if (!nudge || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const text = nudge.startsWith('Quick reset')
      ? `Hey! ${title} is still open. Ready to come back? Brief breaks are okay.`
      : `Hi! ${title} is still open. Take a moment, then come back when you’re ready.`;
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-IN'; speech.pitch = 1.15; speech.rate = 0.94;
    const voices = window.speechSynthesis.getVoices();
    speech.voice = voices.find((voice) => /female|samantha|karen|zira|google.*english.*female/i.test(voice.name)) || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-in')) || null;
    window.speechSynthesis.speak(speech);
    return () => window.speechSynthesis.cancel();
  }, [nudge, title]);

  const toggle = async () => {
    if (active) {
      setActive(false);
      setStatus('Camera is off. Kiko never starts it without your click.');
      return;
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* In-app focus reminders remain available. */ }
    }
    setNudge('');
    setStatus('Requesting camera permission…');
    setActive(true);
  };

  return <>
  <div className={`kiko-focus-nudge ${active ? 'active' : ''}`}>
    <div className="kiko-gaze-copy"><b>{active ? 'Kiko eye-focus nudges are on' : 'Try Kiko eye-focus nudges'}</b><small>Optional camera permission; browser notification permission may also be requested for reminders while you switch tabs. Eye direction is approximate and processed on this device; no video or gaze history is saved. Camera pauses if you switch away.</small><small className="kiko-gaze-status">{status}</small>{nudge && <span role="status">{nudge}</span>}<details><summary>How this works</summary><p>Kiko looks for sustained sideways eye direction and waits 12 seconds before a gentle reminder. Glances and breaks are normal; this is not attendance, an exam monitor, or proof of attention. You can stop it any time.</p></details></div>
    {active && <video ref={videoRef} className="kiko-camera-preview" muted playsInline aria-label="Local camera preview for Kiko eye focus" />}
    <button className={active ? 'secondary' : 'primary'} onClick={() => void toggle()}>{active ? 'Stop camera' : 'Enable camera'}</button>
  </div>
  {nudge && createPortal(<div className="kiko-focus-overlay" role="dialog" aria-modal="true" aria-label="Kiko focus reminder"><section><div className="kiko-focus-walker"><BuddyCreature mood="supportive" /></div><small>KIKO · CLASS CHECK-IN</small><h2>Ready to come back?</h2><p>{nudge}</p><button className="primary" onClick={() => { setNudge(''); window.speechSynthesis?.cancel(); }}>I’m back <ArrowRight size={14} /></button><small className="kiko-focus-privacy">Gentle reminder only · eye direction is approximate and stays on this device.</small></section></div>, document.body)}
  </>;
}

function Notifications({ c }: { c: Ctx }) {
  const mark = async (id?: string) => {
    if (!supabase || !id) return;
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', c.userId);
    if (error) c.say(error.message, 'error');
    else c.setNotices(c.notices.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const all = async () => {
    if (!supabase) return;
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', c.userId).is('read_at', null);
    if (error) c.say(error.message, 'error');
    else c.setNotices(c.notices.map((n) => ({ ...n, unread: false })));
  };

  return (
    <>
      <Head
        tag="STAY IN THE LOOP"
        title="Notifications"
        desc="Updates saved to your Kariqo account."
        action={
          <button className="secondary" onClick={all}>
            <Check size={15} /> Mark all as read
          </button>
        }
      />
      {c.notices.map((n) => (
        <Panel className={'notice ' + (n.unread ? 'new' : '')} key={n.id}>
          <div className="notice-icon">
            <Bell />
          </div>
          <span>
            <b>{n.title}</b>
            <p>{n.detail}</p>
            <small>{n.time}</small>
          </span>
          {n.unread && <button onClick={() => mark(n.id)}>Mark read</button>}
        </Panel>
      ))}
      {!c.notices.length && (
        <Panel>
          <h3>No notifications</h3>
          <p>Your account updates will appear here.</p>
        </Panel>
      )}
    </>
  );
}

function Announcements({ c }: { c: Ctx }) {
  return (
    <>
      <Head tag="FROM YOUR KARIQO COMMUNITY" title="Announcements" desc="Updates published by the Brain Strom team." />
      {c.records.announcements.map((x) => (
        <Panel className="announcement-row" key={x.id}>
          <span>
            <small>
              {new Date(x.created_at).toLocaleDateString()} · {x.author}
            </small>
            <h3>{x.title}</h3>
            <p>{x.body}</p>
          </span>
        </Panel>
      ))}
      {!c.records.announcements.length && (
        <Panel>
          <h3>No announcements yet</h3>
          <p>Updates from Brain Strom will show here when published.</p>
        </Panel>
      )}
    </>
  );
}

function Support({ c }: { c: Ctx }) {
  const [messages, setMessages] = useState<Record<string, any>[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !c.userId) return;
    let live = true;
    supabase
      .from('support_messages')
      .select('id,topic,body,status,staff_reply,created_at,updated_at')
      .eq('user_id', c.userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) c.say(dbMessage(error, 'Could not load your support requests'), 'error');
        else setMessages(data || []);
      });
    return () => {
      live = false;
    };
  }, [c.userId]);

  const send = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return c.say('Support is unavailable: backend is not connected', 'error');
    const form = e.currentTarget;
    const f = new FormData(form);
    const topic = String(f.get('topic'));
    const body = String(f.get('body')).trim();

    if (!body) return c.say('Type your message first', 'error');
    setBusy(true);

    const { data, error } = await supabase.from('support_messages').insert({ user_id: c.userId, topic, body }).select('id,topic,body,status,staff_reply,created_at,updated_at').single();
    setBusy(false);

    if (error) {
      c.say(dbMessage(error, 'Could not send support request'), 'error');
      return;
    }

    form.reset();
    if (data) setMessages((rows) => [data, ...rows]);
    c.say('Your request was sent to the Kariqo customer care team.', 'success');
  };

  return (
    <>
      <Head tag="WE'RE HERE TO HELP" title="Customer care" desc="Send a support request and keep track of the messages you have submitted." />
      <div className="support-layout">
        <div>
          <div className="support-banner">
            <span>✳</span>
            <h2>
              What can we help
              <br />
              you <em>figure out?</em>
            </h2>
            <p>Your request is saved privately to your Kariqo account. The Kariqo team can review it, update its status, and reply here.</p>
          </div>
          <Panel className="support-history">
            <h3>Your requests</h3>
            {messages.length ? (
              messages.map((m) => (
                <article key={m.id}>
                  <div>
                    <b>{m.topic}</b>
                    <small>{new Date(m.created_at).toLocaleString()}</small>
                  </div>
                  <p>{m.body}</p>
                  <span className={`support-status ${m.status || 'open'}`}>{String(m.status || 'open').replace('_', ' ')}</span>
                  {m.staff_reply && <div className="support-team-reply"><b>Kariqo team reply</b><p>{m.staff_reply}</p></div>}
                  <small>Reference: {m.id.slice(0, 8).toUpperCase()}</small>
                </article>
              ))
            ) : (
              <p>No support requests yet. Messages you send will appear here.</p>
            )}
          </Panel>
        </div>
        <form className="panel support-form" onSubmit={send}>
          <h3>Send a request</h3>
          <label>
            What do you need help with?
            <select name="topic">
              {[
                'Account & profile',
                'Skill DNA & roadmap',
                'Projects & Skill Passport',
                'Mentorship & classes',
                'Opportunities',
                'Something else',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Your message
            <textarea name="body" placeholder="Share a few details so we can help..." rows={7} required />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send a message'} <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </>
  );
}

function Profile({ c }: { c: Ctx }) {
  const p = c.records.profile;
  const prefs = c.records.preferences;
  const [showKiko, setShowKiko] = useState(() => storage.getItem(`kariqo-kiko-hidden:${c.userId}`) !== 'true');

  useEffect(() => {
    setShowKiko(storage.getItem(`kariqo-kiko-hidden:${c.userId}`) !== 'true');
  }, [c.userId]);

  const updateKikoVisibility = (show: boolean) => {
    setShowKiko(show);
    storage.setItem(`kariqo-kiko-hidden:${c.userId}`, show ? 'false' : 'true');
    window.dispatchEvent(new CustomEvent('kariqo-kiko-visibility', { detail: show }));
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await c.saveProfile({
        full_name: String(f.get('full_name')),
        college: String(f.get('college')),
        course: String(f.get('course')),
        career_goal: String(f.get('career_goal')),
        bio: String(f.get('bio')),
      });
      if (supabase) {
        const { error } = await supabase.from('preferences').upsert({
          user_id: c.userId,
          email_opportunities: f.has('email_opportunities'),
          learning_reminders: f.has('learning_reminders'),
          community_updates: f.has('community_updates'),
        });
        if (error) throw error;
      }
      c.say('Profile saved to your account', 'success');
    } catch (e) {
      c.say(e instanceof Error ? e.message : 'Could not save profile', 'error');
    }
  };

  return (
    <>
      <Head tag="MAKE IT YOURS" title="Profile & settings" desc="Your account details and learning preferences." />
      <div className="profile-layout">
        <div>
          <form className="panel profile-panel" onSubmit={save}>
            <div className="cover">KARIQO · LEARN BUILD PROVE CONNECT</div>
            <div className="profile-tools">
              <label className="photo-picker">
                <Avatar user={c.user} photo={c.photo} />
                <span>Change photo</span>
                <input type="file" accept="image/*" onChange={c.upload} />
              </label>
              <button className="primary">
                Save changes <Check size={14} />
              </button>
            </div>
            <div className="fields">
              <label>
                Full name
                <input name="full_name" defaultValue={p.full_name || c.user} required />
              </label>
              <label>
                Email address
                <input value={c.email} readOnly />
              </label>
              <label>
                College or university
                <input name="college" defaultValue={p.college || ''} />
              </label>
              <label>
                Course and year
                <input name="course" defaultValue={p.course || ''} />
              </label>
              <label className="wide-field">
                Career goal
                <input name="career_goal" defaultValue={p.career_goal || ''} placeholder="e.g. Full Stack Developer" />
              </label>
              <label className="wide-field">
                About me
                <textarea name="bio" defaultValue={p.bio || ''} rows={3} placeholder="Tell us about yourself..." />
              </label>
            </div>
            <div className="preferences">
              <h3>Learning preferences</h3>
              <label>
                <span>
                  <b>Email me about new opportunities</b>
                </span>
                <input name="email_opportunities" type="checkbox" defaultChecked={prefs.email_opportunities ?? true} />
              </label>
              <label>
                <span>
                  <b>Learning reminders</b>
                </span>
                <input name="learning_reminders" type="checkbox" defaultChecked={prefs.learning_reminders ?? false} />
              </label>
              <label>
                <span>
                  <b>Mentor and community updates</b>
                </span>
                <input name="community_updates" type="checkbox" defaultChecked={prefs.community_updates ?? true} />
              </label>
              <label>
                <span>
                  <b>Show Kiko companion</b>
                  <small>Hide or bring back your Kiko pet any time.</small>
                </span>
                <input type="checkbox" checked={showKiko} onChange={(event) => updateKikoVisibility(event.target.checked)} />
              </label>
            </div>
          </form>
        </div>
        <div>
          <Panel className="account">
            <h3>Account</h3>
            <button
              onClick={async () => {
                if (!supabase) return;
                const { error } = await supabase.auth.resetPasswordForEmail(c.email);
                c.say(error ? error.message : 'Password reset email sent', error ? 'error' : 'success');
              }}
            >
              Change password <ArrowRight />
            </button>
            <button onClick={() => c.say('Privacy policy is available from the Kariqo team', 'info')}>
              Privacy policy <ArrowRight />
            </button>
          </Panel>
          <Panel>
            <h3>About this workspace</h3>
            <b>BS　 Brain Strom</b>
            <p>Kariqo brings skills, learning, mentorship, and opportunity into one connected journey.</p>
          </Panel>
          <button className="logout" onClick={c.logout}>
            <LogOut /> Sign out of Kariqo
          </button>
          <small>Your profile data is protected by account-level access policies.</small>
        </div>
      </div>
    </>
  );
}

function EditorDialog({
  title,
  busy,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-shade"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="panel editor-dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>{title}</h2>
        <p>Saved to your private Kariqo account.</p>
        {children}
        <div className="editor-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

function dbMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return fallback;
}

async function functionErrorMessage(error: unknown, fallback: string) {
  let detail = dbMessage(error, fallback);
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === 'string') detail = body.error;
      } catch { /* Use the message provided by Supabase Functions. */ }
    }
  }
  return detail;
}
