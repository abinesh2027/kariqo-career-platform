import { supabase } from './supabase';

export interface RoadmapGaps {
  skill: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
  first_step: string;
}

export interface RoadmapWeek {
  week: number;
  title: string;
  activities: string[];
  outcome: string;
}

export interface RoadmapProject {
  title: string;
  description: string;
  skills_used: string[];
}

export interface RoadmapResult {
  summary: string;
  strengths: string[];
  gaps: RoadmapGaps[];
  weeks: RoadmapWeek[];
  project_ideas: RoadmapProject[];
  next_action: string;
}

// Built-in career knowledge base for intelligent fallback analysis
const CAREER_PROFILES: Record<string, {
  coreSkills: string[];
  reasons: Record<string, string>;
  firstSteps: Record<string, string>;
  projectTemplates: Array<{ title: string; desc: string; skills: string[] }>;
}> = {
  frontend: {
    coreSkills: ['HTML & Semantic Web', 'CSS & Flexbox/Grid', 'JavaScript (ES6+)', 'TypeScript', 'React / Next.js', 'Responsive Web Design', 'State Management', 'REST API Integration', 'Git & GitHub', 'Performance Optimization'],
    reasons: {
      'HTML & Semantic Web': 'Essential foundation for accessible, SEO-friendly web architecture.',
      'CSS & Flexbox/Grid': 'Required for crafting modern, responsive, visually polished layouts.',
      'JavaScript (ES6+)': 'Core programming language of the modern web for dynamic client-side experiences.',
      'TypeScript': 'Industry standard for type safety, maintainability, and bug reduction in web apps.',
      'React / Next.js': 'Most in-demand library for component-based web user interfaces.',
      'REST API Integration': 'Crucial for connecting frontend interfaces with live databases and services.',
      'Git & GitHub': 'Mandatory version control skill for engineering workflows and team collaboration.',
    },
    firstSteps: {
      'TypeScript': 'Convert a small JS script to TS, defining explicit interfaces and typing variables.',
      'React / Next.js': 'Build a dynamic dashboard component with stateful filtering and search.',
      'REST API Integration': 'Fetch and display paginated data with loading/error states using async/await.',
      'Git & GitHub': 'Create a GitHub repo, initialize commits with conventional commit messages, and deploy.',
    },
    projectTemplates: [
      { title: 'Interactive Developer Portfolio & CMS', desc: 'A blazing-fast portfolio showcasing verified skills, dark mode, and dynamic project filtering.', skills: ['React', 'TypeScript', 'CSS Flexbox/Grid'] },
      { title: 'SaaS Metric & Analytics Dashboard', desc: 'Real-time dashboard visualizing user analytics, charts, and API-driven telemetry.', skills: ['TypeScript', 'REST API Integration', 'React'] },
      { title: 'Collaborative Task & Kanban Board', desc: 'Drag-and-drop task management tool with persistent storage and smooth animations.', skills: ['JavaScript (ES6+)', 'React', 'Git & GitHub'] },
    ],
  },
  backend: {
    coreSkills: ['Node.js & Express', 'PostgreSQL / SQL', 'REST & GraphQL APIs', 'Authentication & JWT/OAuth', 'Database Indexing & Modeling', 'Docker & Containerization', 'Cloud Deployment & DevOps', 'API Security & Rate Limiting'],
    reasons: {
      'Node.js & Express': 'Core runtime for building high-concurrency server applications.',
      'PostgreSQL / SQL': 'Gold standard relational database system for structured transactional data.',
      'Authentication & JWT/OAuth': 'Essential for securing user sessions, role-based access, and identity.',
      'API Security & Rate Limiting': 'Protects backend servers against abuse, DDoS, and injection vulnerabilities.',
    },
    firstSteps: {
      'PostgreSQL / SQL': 'Design a normalized schema with foreign keys and write parameterized queries.',
      'Authentication & JWT/OAuth': 'Implement password hashing with bcrypt and secure JWT cookie sessions.',
      'Docker & Containerization': 'Write a multi-stage Dockerfile and containerize a Node.js microservice.',
    },
    projectTemplates: [
      { title: 'Secure Multi-Tenant Auth & API Gateway', desc: 'Production-ready authentication server with refresh token rotation and rate limiting.', skills: ['Node.js & Express', 'PostgreSQL / SQL', 'Authentication & JWT/OAuth'] },
      { title: 'Real-time Event Ticketing Engine', desc: 'High-concurrency booking API handling database transactions and seat reservations.', skills: ['PostgreSQL / SQL', 'REST & GraphQL APIs', 'Docker'] },
    ],
  },
  fullstack: {
    coreSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL / Supabase', 'RESTful API Architecture', 'Tailwind / Modern CSS', 'Git & Version Control', 'Authentication & Security', 'CI/CD & Cloud Deployment'],
    reasons: {
      'TypeScript': 'Ensures end-to-end type safety between frontend UI and backend services.',
      'React': 'Enables modular, interactive client applications with smooth user feedback.',
      'PostgreSQL / Supabase': 'Provides enterprise-grade database management and real-time synchronization.',
      'Authentication & Security': 'Guarantees secure user authentication and granular Row Level Security.',
    },
    firstSteps: {
      'TypeScript': 'Set up a shared types library used across both frontend components and API routes.',
      'PostgreSQL / Supabase': 'Create relational tables with RLS policies ensuring users only access their records.',
      'Node.js': 'Build a REST service with middleware validation and centralized error handling.',
    },
    projectTemplates: [
      { title: 'Student Skill & Portfolio Verification Hub', desc: 'Full-stack application allowing students to track skills, upload artifacts, and share verified passports.', skills: ['React', 'TypeScript', 'Supabase', 'Node.js'] },
      { title: 'Interactive Learning Platform with AI Mentor', desc: 'Web app with dynamic quizzes, personalized progress tracking, and AI-assisted roadmap reviews.', skills: ['TypeScript', 'React', 'RESTful API Architecture'] },
    ],
  },
  ai_ml: {
    coreSkills: ['Python & NumPy/Pandas', 'Machine Learning Algorithms', 'Deep Learning & PyTorch', 'LLMs & Prompt Engineering', 'Vector Databases & RAG', 'Model Evaluation & Fine-tuning', 'Data Visualization', 'MLOps & Model Deployment'],
    reasons: {
      'Python & NumPy/Pandas': 'Universal foundation for scientific computation, data wrangling, and ML.',
      'LLMs & Prompt Engineering': 'State-of-the-art technique for building generative and reasoning agent applications.',
      'Vector Databases & RAG': 'Standard architecture for augmenting AI models with private organizational knowledge.',
    },
    firstSteps: {
      'Python & NumPy/Pandas': 'Clean an unstructured dataset, handle missing values, and extract statistical metrics.',
      'LLMs & Prompt Engineering': 'Build a structured JSON extraction pipeline using Gemini API with few-shot prompts.',
      'Vector Databases & RAG': 'Embed documents using sentence transformers and perform similarity search.',
    },
    projectTemplates: [
      { title: 'Intelligent Knowledge Base RAG Assistant', desc: 'Document questioning system using vector search and generative LLM summarization.', skills: ['Python & NumPy/Pandas', 'LLMs & Prompt Engineering', 'Vector Databases & RAG'] },
      { title: 'Predictive Student Performance Model', desc: 'Supervised ML model predicting course completion based on historical learning behavior.', skills: ['Python & NumPy/Pandas', 'Machine Learning Algorithms', 'Data Visualization'] },
    ],
  },
  mobile: {
    coreSkills: ['React Native / Flutter', 'Mobile UI/UX Best Practices', 'State Management', 'REST/GraphQL Networking', 'Offline Storage & SQLite', 'Push Notifications', 'App Store / Play Store Deployment'],
    reasons: {
      'React Native / Flutter': 'Dominant framework for high-performance cross-platform iOS and Android apps.',
      'Offline Storage & SQLite': 'Ensures mobile apps remain functional even with intermittent connectivity.',
    },
    firstSteps: {
      'React Native / Flutter': 'Build a mobile screen with responsive styling, navigation, and touch gestures.',
      'Offline Storage & SQLite': 'Implement local caching with SQLite to keep user data accessible offline.',
    },
    projectTemplates: [
      { title: 'Habit & Daily Goal Tracking App', desc: 'Clean cross-platform mobile application with haptics, daily streak counters, and offline sync.', skills: ['React Native / Flutter', 'Offline Storage & SQLite', 'Mobile UI/UX'] },
    ],
  },
};

function matchCareerProfile(goal: string) {
  const g = goal.toLowerCase();
  if (g.includes('front') || g.includes('ui') || g.includes('web design') || g.includes('react')) return CAREER_PROFILES.frontend;
  if (g.includes('back') || g.includes('node') || g.includes('server') || g.includes('database')) return CAREER_PROFILES.backend;
  if (g.includes('ai') || g.includes('machine') || g.includes('data') || g.includes('ml') || g.includes('deep')) return CAREER_PROFILES.ai_ml;
  if (g.includes('mobile') || g.includes('android') || g.includes('ios') || g.includes('flutter')) return CAREER_PROFILES.mobile;
  return CAREER_PROFILES.fullstack;
}

export function generateLocalRoadmap(goal: string, existingSkills: Array<Record<string, any>>): RoadmapResult {
  const normalizedGoal = goal.trim() || 'Software Engineer';
  const profile = matchCareerProfile(normalizedGoal);

  const existingNames = new Set(existingSkills.map(s => String(s.name || '').trim().toLowerCase()).filter(Boolean));
  
  const strengths: string[] = [];
  const candidateGaps: string[] = [];

  // Categorize profile skills
  profile.coreSkills.forEach(skill => {
    const isPresent = existingNames.has(skill.toLowerCase()) ||
      Array.from(existingNames).some(name => skill.toLowerCase().includes(name) || name.includes(skill.toLowerCase()));
    if (isPresent) {
      strengths.push(skill);
    } else {
      candidateGaps.push(skill);
    }
  });

  // Also retain user's existing skills as strengths
  existingSkills.forEach(s => {
    if (!strengths.some(st => st.toLowerCase() === s.name.toLowerCase())) {
      strengths.push(s.name);
    }
  });

  // Pick top 3-4 gaps
  const topGaps = candidateGaps.slice(0, 4);
  if (topGaps.length === 0) {
    topGaps.push('Advanced System Design & Architecture', 'CI/CD Pipelines & Cloud Deployment');
  }

  const gapPriorities: Array<'High' | 'Medium' | 'Low'> = ['High', 'High', 'Medium', 'Low'];
  const gaps: RoadmapGaps[] = topGaps.map((skill, idx) => ({
    skill,
    priority: gapPriorities[idx] || 'Medium',
    reason: profile.reasons[skill] || `Core competency required for high performance as a ${normalizedGoal}.`,
    first_step: profile.firstSteps[skill] || `Spend 2 hours building a minimal standalone exercise demonstrating ${skill}.`,
  }));

  // Build realistic 6-week curriculum
  const primaryGap = gaps[0]?.skill || 'Core Fundamentals';
  const secondaryGap = gaps[1]?.skill || 'Applied Engineering';
  const tertiaryGap = gaps[2]?.skill || 'Advanced Patterns';

  const weeks: RoadmapWeek[] = [
    {
      week: 1,
      title: `Foundations & Setup: ${primaryGap}`,
      activities: [
        `Audit your current technical stack and establish standard development tools.`,
        `Study foundational concepts of ${primaryGap} through official documentation and practical tutorials.`,
        `Complete 3 mini-exercises implementing key syntactical patterns of ${primaryGap}.`,
      ],
      outcome: `Working repository with solved code snippets demonstrating ${primaryGap} essentials.`,
    },
    {
      week: 2,
      title: `Practical Implementation: ${primaryGap} in Depth`,
      activities: [
        `Deepen proficiency with ${primaryGap} by handling edge cases and state management.`,
        `Integrate ${primaryGap} into an existing component or API service.`,
        `Write basic unit tests or sanity assertions verifying functional correctness.`,
      ],
      outcome: `Modular, self-contained module demonstrating clean ${primaryGap} best practices.`,
    },
    {
      week: 3,
      title: `Expanding Scope: ${secondaryGap}`,
      activities: [
        `Identify how ${secondaryGap} bridges with ${primaryGap} in production applications.`,
        `Build a functional proof-of-concept incorporating ${secondaryGap}.`,
        `Review code for security, error boundaries, and performance bottlenecks.`,
      ],
      outcome: `A connected sub-system demonstrating combined usage of ${primaryGap} and ${secondaryGap}.`,
    },
    {
      week: 4,
      title: `Architecture & Tooling: ${tertiaryGap}`,
      activities: [
        `Implement ${tertiaryGap} to elevate project reliability and engineering standards.`,
        `Configure linting, automated formatting, and version control hygiene.`,
        `Document system architecture with clear markdown specifications.`,
      ],
      outcome: `Production-grade architecture draft and working integration branch.`,
    },
    {
      week: 5,
      title: 'Capstone Project Build Phase',
      activities: [
        `Architect and scaffold the main portfolio capstone project aligning with ${normalizedGoal}.`,
        `Implement core user flows, database persistence, and clean user interface.`,
        `Conduct end-to-end testing across happy paths and error boundaries.`,
      ],
      outcome: `Complete functional alpha version of your signature portfolio project.`,
    },
    {
      week: 6,
      title: 'Polishing, Proof & Career Showcase',
      activities: [
        `Refine visual styling, performance, and accessibility across all screens.`,
        `Write a compelling GitHub README with live demo link and architecture overview.`,
        `Update your Kariqo Skill Passport with verified project evidence and metrics.`,
      ],
      outcome: `Live deployed project and polished Skill Passport ready to share with mentors and recruiters.`,
    },
  ];

  const project_ideas: RoadmapProject[] = profile.projectTemplates.map(p => ({
    title: p.title,
    description: p.desc,
    skills_used: p.skills,
  }));

  const next_action = gaps[0]?.first_step
    ? `Today's Action: ${gaps[0].first_step}`
    : `Set aside 45 minutes today to outline your first project milestone for ${normalizedGoal}.`;

  const summary = `Tailored six-week progression plan for your aspiration as a ${normalizedGoal}. You have a strong head-start in ${strengths.slice(0, 3).join(', ') || 'essential fundamentals'}, with immediate growth focused on ${primaryGap}.`;

  return {
    summary,
    strengths,
    gaps,
    weeks,
    project_ideas,
    next_action,
  };
}

export async function requestAiRoadmap(
  goal: string,
  skills: Array<Record<string, any>>,
  userId: string,
  supabaseUrl?: string,
  supabaseAnonKey?: string,
  roadmapFunctionUrl?: string,
): Promise<RoadmapResult> {
  if (!goal.trim()) {
    throw new Error('Please set your career goal first before generating a roadmap.');
  }
  const edgeUrl = roadmapFunctionUrl || import.meta.env?.VITE_SKILL_ROADMAP_FUNCTION_URL;
  if (!supabase) throw new Error('Kariqo backend is not connected.');
  if (!edgeUrl) throw new Error('AI roadmap service is not configured in this app build.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again before generating a roadmap.');

  const response = await fetch(edgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey || import.meta.env?.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify({ goal, skills }),
  });

  let payload: any;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const detail = [payload?.error, payload?.detail].filter(Boolean).join(': ');
    throw new Error(detail || `AI roadmap request failed (${response.status}).`);
  }
  if (!payload?.result?.summary) throw new Error('Gemini returned an empty roadmap. Please try again.');

  const { error } = await supabase.from('roadmaps').insert({
    user_id: userId,
    career_goal: goal,
    content: payload.result,
  });
  if (error) throw new Error(`Gemini created a roadmap, but Kariqo could not save it: ${error.message}`);
  return payload.result as RoadmapResult;
}
