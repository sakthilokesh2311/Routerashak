import { isSupabaseConfigured } from '../lib/supabase';
import type { AppData } from '../types';
import { readData as readDemoData, resetData as resetDemoData, writeData as writeDemoData } from './demo';
import { fetchAppDataFromSupabase, subscribeToSupabaseRealtime } from './supabaseService';

export function readData(): AppData {
  return readDemoData();
}

export function writeData(data: AppData): void {
  writeDemoData(data);
}

export function resetData(): void {
  resetDemoData();
}

type DataListener = (data: AppData) => void;
const listeners = new Set<DataListener>();

export function onAppDataChange(listener: DataListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(data: AppData) {
  for (const listener of listeners) {
    try {
      listener(data);
    } catch (e) {
      console.error('[SupabaseSync] Listener error:', e);
    }
  }
}

let syncInitialized = false;

/**
 * Initializes automatic background synchronization and real-time listeners with Supabase
 */
export function initSupabaseSync(onUpdate?: (data: AppData) => void): void {
  if (onUpdate) {
    listeners.add(onUpdate);
  }

  // Always trigger a background fetch if Supabase is configured
  if (isSupabaseConfigured()) {
    fetchAppDataFromSupabase()
      .then(remoteData => {
        if (remoteData && (remoteData.buses.length > 0 || remoteData.routes.length > 0)) {
          writeDemoData(remoteData);
          notifyListeners(remoteData);
          console.log('[Supabase] Successfully synchronized remote tables.');
        }
      })
      .catch(err => {
        console.warn('[Supabase] Initial sync failed, using local cache:', err);
      });
  }

  if (syncInitialized || !isSupabaseConfigured()) return;
  syncInitialized = true;

  console.log('[Supabase] Subscribing to realtime updates...');

  // 2. Real-time updates subscription
  subscribeToSupabaseRealtime(() => {
    fetchAppDataFromSupabase()
      .then(remoteData => {
        if (remoteData) {
          writeDemoData(remoteData);
          notifyListeners(remoteData);
          console.log('[Supabase] Realtime update applied across portals.');
        }
      })
      .catch(err => console.warn('[Supabase] Realtime sync error:', err));
  });
}

