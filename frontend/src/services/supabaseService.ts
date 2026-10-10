import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AppData, Booking, CampusRoute, Incident, Journey, NotificationItem, RescueRequest, Stop } from '../types';

/**
 * Fetch all AppData tables from Supabase.
 * Returns null if Supabase is not configured or an error occurs.
 */
export async function fetchAppDataFromSupabase(): Promise<AppData | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const [
      busesRes,
      driversRes,
      routesRes,
      bookingsRes,
      journeysRes,
      rescuesRes,
      incidentsRes,
      notificationsRes,
    ] = await Promise.all([
      supabase.from('buses').select('*'),
      supabase.from('drivers').select('*'),
      supabase.from('routes').select('*'),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('journeys').select('*'),
      supabase.from('rescue_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('incidents').select('*').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
    ]);

    if (busesRes.error || driversRes.error || routesRes.error) {
      console.warn('Supabase fetch returned error:', busesRes.error || driversRes.error || routesRes.error);
      return null;
    }

    const buses = (busesRes.data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      plate: b.plate,
      capacity: Number(b.capacity),
      available: Number(b.available),
      accessible: Boolean(b.accessible),
      status: b.status,
      routeId: b.route_id || undefined,
    }));

    const drivers = (driversRes.data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      busId: d.bus_id,
      routeId: d.route_id,
      status: d.status,
    }));

    const routes = (routesRes.data || []).map((r: any) => {
      const rawStops: Stop[] = Array.isArray(r.stops) ? r.stops : [];
      // Sort stops ascending by time
      const sortedStops = rawStops.slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      sortedStops.forEach((s, idx) => { s.sequence = idx + 1; });

      return {
        id: r.id,
        name: r.name,
        origin: r.origin,
        destination: r.destination,
        duration: Number(r.duration),
        busId: r.bus_id,
        accessible: Boolean(r.accessible),
        status: r.status,
        stops: sortedStops,
        schedule: typeof r.schedule === 'object' && r.schedule !== null ? r.schedule : { departure: '', arrival: '', days: [] },
      };
    });

    const bookings = (bookingsRes.data || []).map((b: any) => ({
      id: b.id,
      reference: b.reference,
      userId: b.user_id,
      routeId: b.route_id,
      busId: b.bus_id,
      date: b.date,
      status: b.status,
      createdAt: b.created_at,
    }));

    const journeys = (journeysRes.data || []).map((j: any) => ({
      id: j.id,
      routeId: j.route_id,
      busId: j.bus_id,
      status: j.status,
      date: j.date,
      completedStops: Number(j.completed_stops || 0),
    }));

    const rescues = (rescuesRes.data || []).map((req: any) => ({
      id: req.id,
      userId: req.user_id,
      routeId: req.route_id,
      bookingId: req.booking_id || undefined,
      category: req.category,
      description: req.description,
      status: req.status,
      replacementBusId: req.replacement_bus_id || undefined,
      createdAt: req.created_at,
      notes: Array.isArray(req.notes) ? req.notes : [],
      source: req.source,
    }));

    const incidents = (incidentsRes.data || []).map((i: any) => ({
      id: i.id,
      driverId: i.driver_id,
      routeId: i.route_id,
      busId: i.bus_id,
      rescueId: i.rescue_id,
      category: i.category,
      description: i.description,
      status: i.status,
      createdAt: i.created_at,
    }));

    const notifications = (notificationsRes.data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message,
      createdAt: n.created_at,
      read: Boolean(n.read),
    }));

    return {
      buses,
      drivers,
      routes,
      bookings,
      journeys,
      rescues,
      incidents,
      notifications,
      preferences: {},
    };
  } catch (err) {
    console.error('Error fetching data from Supabase:', err);
    return null;
  }
}

/**
 * Inserts a new booking into Supabase
 */
export async function supabaseCreateBooking(booking: Booking, route: CampusRoute): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error: bookingErr } = await supabase.from('bookings').insert({
      id: booking.id,
      reference: booking.reference,
      user_id: booking.userId,
      route_id: booking.routeId,
      bus_id: booking.busId,
      date: booking.date,
      status: booking.status,
      created_at: booking.createdAt,
    });
    if (bookingErr) throw bookingErr;

    // Decrement available seat count
    const { data: bus } = await supabase.from('buses').select('available').eq('id', route.busId).single();
    if (bus && bus.available > 0) {
      await supabase.from('buses').update({ available: bus.available - 1 }).eq('id', route.busId);
    }

    // Add confirmation notification
    await supabase.from('notifications').insert({
      id: `notice-${Date.now()}`,
      user_id: booking.userId,
      title: 'Seat booked',
      message: `Your ${route.name} journey is confirmed. Reference ${booking.reference}.`,
      created_at: new Date().toISOString(),
      read: false,
    });

    return true;
  } catch (err) {
    console.error('supabaseCreateBooking error:', err);
    return false;
  }
}

/**
 * Cancels a booking in Supabase
 */
export async function supabaseCancelBooking(bookingId: string, busId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('bookings').update({ status: 'Cancelled' }).eq('id', bookingId);
    if (error) throw error;

    if (busId) {
      const { data: bus } = await supabase.from('buses').select('available, capacity').eq('id', busId).single();
      if (bus) {
        await supabase.from('buses').update({ available: Math.min(bus.capacity, bus.available + 1) }).eq('id', busId);
      }
    }
    return true;
  } catch (err) {
    console.error('supabaseCancelBooking error:', err);
    return false;
  }
}

/**
 * Creates a rescue request in Supabase
 */
export async function supabaseCreateRescue(rescue: RescueRequest, routeName = 'a route'): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('rescue_requests').insert({
      id: rescue.id,
      user_id: rescue.userId,
      route_id: rescue.routeId,
      booking_id: rescue.bookingId || null,
      category: rescue.category,
      description: rescue.description,
      status: rescue.status,
      created_at: rescue.createdAt,
      notes: rescue.notes,
      source: rescue.source,
    });
    if (error) throw error;

    // Send admin notification
    await supabase.from('notifications').insert([
      {
        id: `notice-${Date.now()}-a`,
        user_id: 'admin-1',
        title: 'New rescue request',
        message: `${rescue.source} reported a ${rescue.category.toLowerCase()} on ${routeName}.`,
        created_at: new Date().toISOString(),
        read: false,
      },
      ...(rescue.userId !== 'admin-1'
        ? [
            {
              id: `notice-${Date.now()}-u`,
              user_id: rescue.userId,
              title: 'Rescue request submitted',
              message: 'Your request is with the transport team.',
              created_at: new Date().toISOString(),
              read: false,
            },
          ]
        : []),
    ]);

    return true;
  } catch (err) {
    console.error('supabaseCreateRescue error:', err);
    return false;
  }
}

/**
 * Assigns a replacement bus to a rescue request
 */
export async function supabaseAssignReplacement(rescueId: string, busId: string, studentUserId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: bus } = await supabase.from('buses').select('name, available').eq('id', busId).single();
    if (!bus) return false;

    await supabase.from('buses').update({
      status: 'Assigned',
      available: Math.max(0, (bus.available || 1) - 1),
    }).eq('id', busId);

    const { data: rescue } = await supabase.from('rescue_requests').select('notes').eq('id', rescueId).single();
    const notes = Array.isArray(rescue?.notes) ? rescue.notes : [];
    notes.unshift(`Replacement ${bus.name} assigned by transport admin.`);

    await supabase.from('rescue_requests').update({
      replacement_bus_id: busId,
      status: 'Replacement Assigned',
      notes,
    }).eq('id', rescueId);

    await supabase.from('notifications').insert([
      {
        id: `notice-${Date.now()}-s`,
        user_id: studentUserId,
        title: 'Replacement assigned',
        message: `${bus.name} has been assigned to your rescue request.`,
        created_at: new Date().toISOString(),
        read: false,
      },
      {
        id: `notice-${Date.now()}-d`,
        user_id: 'admin-1',
        title: 'Replacement dispatched',
        message: `${bus.name} is attached to case ${rescueId}.`,
        created_at: new Date().toISOString(),
        read: false,
      },
    ]);

    return true;
  } catch (err) {
    console.error('supabaseAssignReplacement error:', err);
    return false;
  }
}

/**
 * Update rescue status in Supabase
 */
export async function supabaseUpdateRescueStatus(id: string, status: RescueRequest['status'], note = ''): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: rescue } = await supabase.from('rescue_requests').select('notes, user_id').eq('id', id).single();
    if (!rescue) return false;

    const notes = Array.isArray(rescue.notes) ? rescue.notes : [];
    if (note) notes.unshift(note);

    await supabase.from('rescue_requests').update({ status, notes }).eq('id', id);

    await supabase.from('notifications').insert({
      id: `notice-${Date.now()}`,
      user_id: rescue.user_id,
      title: 'Rescue case updated',
      message: `Your case status is now ${status}.`,
      created_at: new Date().toISOString(),
      read: false,
    });

    return true;
  } catch (err) {
    console.error('supabaseUpdateRescueStatus error:', err);
    return false;
  }
}

/**
 * Mark notification as read
 */
export async function supabaseMarkNotificationRead(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    return true;
  } catch (err) {
    console.error('supabaseMarkNotificationRead error:', err);
    return false;
  }
}

/**
 * Sync entire AppData state to Supabase (e.g. for database seeding/initialization)
 */
export async function seedSupabaseFromData(data: AppData): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase credentials are not configured in .env' };
  }

  try {
    // 1. Buses
    for (const b of data.buses) {
      await supabase.from('buses').upsert({
        id: b.id,
        name: b.name,
        plate: b.plate,
        capacity: b.capacity,
        available: b.available,
        accessible: b.accessible,
        status: b.status,
        route_id: b.routeId || null,
      });
    }

    // 2. Routes
    for (const r of data.routes) {
      await supabase.from('routes').upsert({
        id: r.id,
        name: r.name,
        origin: r.origin,
        destination: r.destination,
        duration: r.duration,
        bus_id: r.busId,
        accessible: r.accessible,
        status: r.status,
        stops: r.stops,
        schedule: r.schedule,
      });
    }

    // 3. Drivers
    for (const d of data.drivers) {
      await supabase.from('drivers').upsert({
        id: d.id,
        name: d.name,
        phone: d.phone,
        bus_id: d.busId,
        route_id: d.routeId,
        status: d.status,
      });
    }

    // 4. Journeys
    for (const j of data.journeys) {
      await supabase.from('journeys').upsert({
        id: j.id,
        route_id: j.routeId,
        bus_id: j.busId,
        status: j.status,
        date: j.date,
        completed_stops: j.completedStops,
      });
    }

    // 5. Bookings
    for (const b of data.bookings) {
      await supabase.from('bookings').upsert({
        id: b.id,
        reference: b.reference,
        user_id: b.userId,
        route_id: b.routeId,
        bus_id: b.busId,
        date: b.date,
        status: b.status,
        created_at: b.createdAt,
      });
    }

    // 6. Notifications
    for (const n of data.notifications) {
      await supabase.from('notifications').upsert({
        id: n.id,
        user_id: n.userId,
        title: n.title,
        message: n.message,
        created_at: n.createdAt,
        read: n.read,
      });
    }

    return { success: true, message: 'All tables synced to Supabase successfully!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to sync to Supabase' };
  }
}

/**
 * Setup a Supabase Realtime channel that calls onChange whenever database changes occur
 */
export function subscribeToSupabaseRealtime(onChange: () => void): (() => void) | null {
  if (!isSupabaseConfigured()) return null;

  try {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        onChange();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('Error setting up Supabase Realtime channel:', err);
    return null;
  }
}

/**
 * Update stops for a specific route in Supabase
 */
export async function supabaseUpdateRouteStops(routeId: string, stops: Stop[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('routes').update({ stops }).eq('id', routeId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseUpdateRouteStops error:', err);
    return false;
  }
}

/**
 * Upsert a Bus in Supabase
 */
export async function supabaseUpsertBus(bus: {
  id: string;
  name: string;
  plate: string;
  capacity: number;
  available: number;
  accessible: boolean;
  status: string;
  routeId?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('buses').upsert({
      id: bus.id,
      name: bus.name,
      plate: bus.plate,
      capacity: bus.capacity,
      available: bus.available,
      accessible: bus.accessible,
      status: bus.status,
      route_id: bus.routeId || null,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseUpsertBus error:', err);
    return false;
  }
}

/**
 * Update Bus status/assignment in Supabase
 */
export async function supabaseUpdateBus(busId: string, updates: Partial<{
  name: string;
  plate: string;
  capacity: number;
  available: number;
  accessible: boolean;
  status: string;
  routeId: string | null;
}>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.plate !== undefined) payload.plate = updates.plate;
    if (updates.capacity !== undefined) payload.capacity = updates.capacity;
    if (updates.available !== undefined) payload.available = updates.available;
    if (updates.accessible !== undefined) payload.accessible = updates.accessible;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.routeId !== undefined) payload.route_id = updates.routeId;

    const { error } = await supabase.from('buses').update(payload).eq('id', busId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseUpdateBus error:', err);
    return false;
  }
}

/**
 * Upsert a Route in Supabase
 */
export async function supabaseUpsertRoute(route: CampusRoute): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('routes').upsert({
      id: route.id,
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      duration: route.duration,
      bus_id: route.busId || null,
      accessible: route.accessible,
      status: route.status,
      stops: route.stops,
      schedule: route.schedule,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseUpsertRoute error:', err);
    return false;
  }
}

/**
 * Update Route status in Supabase
 */
export async function supabaseUpdateRouteStatus(routeId: string, status: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('routes').update({ status }).eq('id', routeId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseUpdateRouteStatus error:', err);
    return false;
  }
}

/**
 * Upsert Journey (status / completed stops) in Supabase
 */
export async function supabaseUpsertJourney(journey: Journey): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('journeys').upsert({
      id: journey.id,
      route_id: journey.routeId,
      bus_id: journey.busId,
      status: journey.status,
      date: journey.date,
      completed_stops: journey.completedStops,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseUpsertJourney error:', err);
    return false;
  }
}

/**
 * Insert an incident into Supabase
 */
export async function supabaseCreateIncident(incident: Incident): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('incidents').insert({
      id: incident.id,
      driver_id: incident.driverId,
      route_id: incident.routeId,
      bus_id: incident.busId,
      rescue_id: incident.rescueId,
      category: incident.category,
      description: incident.description,
      status: incident.status,
      created_at: incident.createdAt,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseCreateIncident error:', err);
    return false;
  }
}

/**
 * Update Driver status in Supabase
 */
export async function supabaseUpdateDriverStatus(driverId: string, status: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('drivers').update({ status }).eq('id', driverId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('supabaseUpdateDriverStatus error:', err);
    return false;
  }
}



