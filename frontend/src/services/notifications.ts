import { isSupabaseConfigured } from '../lib/supabase';
import { addNotification as addDemoNotification, markNotificationRead as markDemoNotificationRead } from './demo';
import { supabaseMarkNotificationRead } from './supabaseService';

export function addNotification(userId: string, title: string, message: string): void {
  addDemoNotification(userId, title, message);
}

export function markNotificationRead(id: string): void {
  markDemoNotificationRead(id);
  if (isSupabaseConfigured()) {
    supabaseMarkNotificationRead(id).catch(err => {
      console.error('[Supabase] Failed to mark notification read in backend:', err);
    });
  }
}
