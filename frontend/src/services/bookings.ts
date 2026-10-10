import { isSupabaseConfigured } from '../lib/supabase';
import type { Booking, CampusRoute } from '../types';
import { cancelBooking as cancelDemoBooking, createBooking as createDemoBooking, readData } from './demo';
import { supabaseCancelBooking, supabaseCreateBooking } from './supabaseService';

export function createBooking(route: CampusRoute, date: string, userId: string): Booking {
  const booking = createDemoBooking(route, date, userId);
  if (isSupabaseConfigured()) {
    supabaseCreateBooking(booking, route).catch(err => {
      console.error('[Supabase] Failed to persist booking:', err);
    });
  }
  return booking;
}

export function cancelBooking(id: string): void {
  const currentData = readData();
  const targetBooking = currentData.bookings.find(b => b.id === id);
  cancelDemoBooking(id);
  if (isSupabaseConfigured()) {
    supabaseCancelBooking(id, targetBooking?.busId).catch(err => {
      console.error('[Supabase] Failed to cancel booking:', err);
    });
  }
}
