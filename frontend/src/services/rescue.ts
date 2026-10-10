import { isSupabaseConfigured } from '../lib/supabase';
import type { RescueRequest } from '../types';
import {
  assignReplacement as assignDemoReplacement,
  createRescue as createDemoRescue,
  readData,
  updateRescueStatus as updateDemoRescueStatus,
} from './demo';
import {
  supabaseAssignReplacement,
  supabaseCreateRescue,
  supabaseUpdateRescueStatus,
} from './supabaseService';

export function createRescue(input: Parameters<typeof createDemoRescue>[0]): RescueRequest {
  const rescue = createDemoRescue(input);
  if (isSupabaseConfigured()) {
    const data = readData();
    const route = data.routes.find(r => r.id === input.routeId);
    supabaseCreateRescue(rescue, route?.name).catch(err => {
      console.error('[Supabase] Failed to persist rescue request:', err);
    });
  }
  return rescue;
}

export function assignReplacement(rescueId: string, busId: string): boolean {
  const data = readData();
  const rescue = data.rescues.find(r => r.id === rescueId);
  const ok = assignDemoReplacement(rescueId, busId);
  if (ok && isSupabaseConfigured()) {
    const studentUserId = rescue?.userId || 'student-1';
    supabaseAssignReplacement(rescueId, busId, studentUserId).catch(err => {
      console.error('[Supabase] Failed to assign replacement in backend:', err);
    });
  }
  return ok;
}

export function updateRescueStatus(id: string, status: RescueRequest['status'], note = ''): void {
  updateDemoRescueStatus(id, status, note);
  if (isSupabaseConfigured()) {
    supabaseUpdateRescueStatus(id, status, note).catch(err => {
      console.error('[Supabase] Failed to update rescue status in backend:', err);
    });
  }
}
