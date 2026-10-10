import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Role, User } from '../types';

const USER_STORAGE_KEY = 'routerakshak-user';

/**
 * Returns current cached user synchronously for instant UI rendering
 */
export function currentUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function saveUserToCache(user: User | null): void {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
  window.dispatchEvent(new Event('routerakshak-change'));
}

/**
 * Fetch the authenticated user from Supabase with profile data
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return currentUser();
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      saveUserToCache(null);
      return null;
    }

    // Try to get profile from profiles table
    let role: Role = (user.user_metadata?.role as Role) || 'student';
    let name: string = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
    let phone: string | undefined = user.user_metadata?.phone;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      role = (profile.role as Role) || role;
      name = profile.name || name;
      phone = profile.phone || phone;
    }

    const appUser: User = {
      id: user.id,
      email: user.email || '',
      name,
      role,
      phone,
    };

    saveUserToCache(appUser);
    return appUser;
  } catch (err) {
    console.error('Error fetching Supabase user:', err);
    return currentUser();
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('No user returned upon authentication.');
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    const fallbackUser: User = {
      id: data.user.id,
      email: data.user.email || email,
      name: data.user.user_metadata?.name || email.split('@')[0],
      role: (data.user.user_metadata?.role as Role) || 'student',
      phone: data.user.user_metadata?.phone,
    };
    saveUserToCache(fallbackUser);
    return fallbackUser;
  }
  return user;
}

/**
 * Sign up with email, password, full name, role and optional phone
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  role: Role = 'student',
  phone = ''
): Promise<{ user: User | null; requiresEmailConfirmation: boolean }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        phone,
      },
    },
  });

  if (error) {
    throw error;
  }

  const requiresEmailConfirmation = !data.session && Boolean(data.user);

  if (data.user) {
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name,
        email,
        role,
        phone: phone || null,
      });
    } catch (e) {
      console.warn('Profile insertion warning:', e);
    }

    const appUser: User = {
      id: data.user.id,
      email,
      name,
      role,
      phone: phone || undefined,
    };

    if (data.session) {
      saveUserToCache(appUser);
      return { user: appUser, requiresEmailConfirmation: false };
    }
    return { user: appUser, requiresEmailConfirmation: true };
  }

  return { user: null, requiresEmailConfirmation: true };
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  });

  if (error) {
    throw error;
  }
}

/**
 * Sign out user
 */
export async function logout(): Promise<void> {
  saveUserToCache(null);
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
  }
}

/**
 * Listen for auth state changes
 */
export function initAuthListener(onUserChange: (user: User | null) => void): () => void {
  if (!isSupabaseConfigured()) return () => {};

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const user = await getAuthenticatedUser();
      onUserChange(user);
    } else if (event === 'SIGNED_OUT') {
      saveUserToCache(null);
      onUserChange(null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}
