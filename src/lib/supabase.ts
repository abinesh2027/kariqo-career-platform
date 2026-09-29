import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';
declare global { interface Window { SKILLORA_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string; roadmapFunctionUrl?: string } } }
const url = import.meta.env?.VITE_SUPABASE_URL || window.SKILLORA_CONFIG?.supabaseUrl;
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || window.SKILLORA_CONFIG?.supabaseAnonKey;
export const supabase = url && key ? createClient(url, key, { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }) : null;
export const backendReady = Boolean(supabase);
