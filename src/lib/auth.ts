import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

function isAdminRole(role: unknown): boolean {
  return ['admin', 'administrator', 'administrador'].includes(
    String(role ?? '').trim().toLowerCase()
  );
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  // First try to find in user_profiles
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role')
    .eq('email', email)
    .maybeSingle();

  if (profileData) {
    return profileData as UserProfile;
  }

  // Fallback: check if there's an employee with this email (if email is stored)
  // For now, return null if not found in user_profiles
  return null;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  // Check user_profiles first
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (isAdminRole((profile as { role?: unknown } | null)?.role)) {
    return true;
  }

  const { data: { user } } = await supabase.auth.getUser();
  return isAdminRole(user?.app_metadata?.role) || isAdminRole(user?.user_metadata?.role);
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
