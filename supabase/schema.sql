-- ====================================================================
-- RouteRakshak AI - Supabase Database Schema & Authentication Setup
-- ====================================================================
-- Instructions:
-- 1. Go to your Supabase Project: https://supabase.com/dashboard
-- 2. Open the "SQL Editor" in the left sidebar.
-- 3. Paste this entire script and click "Run".
-- ====================================================================

-- 1. USER PROFILES TABLE (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'driver', 'admin')),
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create a profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. BUSES TABLE
CREATE TABLE IF NOT EXISTS public.buses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plate TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 36,
    available INTEGER NOT NULL DEFAULT 36,
    accessible BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Assigned', 'Maintenance')),
    route_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    bus_id TEXT,
    route_id TEXT,
    status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'On duty', 'Off duty')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ROUTES TABLE
CREATE TABLE IF NOT EXISTS public.routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30,
    bus_id TEXT,
    accessible BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stops JSONB NOT NULL DEFAULT '[]'::jsonb,
    schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL,
    user_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    bus_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Completed', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. JOURNEYS TABLE
CREATE TABLE IF NOT EXISTS public.journeys (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    bus_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Boarding', 'In Transit', 'Delayed', 'Completed')),
    date TEXT NOT NULL,
    completed_stops INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RESCUE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.rescue_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    booking_id TEXT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Replacement Requested', 'Replacement Assigned', 'Resolved', 'Closed')),
    replacement_bus_id TEXT,
    notes JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT NOT NULL DEFAULT 'Student' CHECK (source IN ('Student', 'Driver')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. INCIDENTS TABLE
CREATE TABLE IF NOT EXISTS public.incidents (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    bus_id TEXT NOT NULL,
    rescue_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Submitted',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. USER PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id TEXT PRIMARY KEY,
    wheelchair BOOLEAN DEFAULT false,
    low_step BOOLEAN DEFAULT false,
    quiet_ride BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow access profiles" ON public.profiles;
    CREATE POLICY "Allow access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access buses" ON public.buses;
    CREATE POLICY "Public access buses" ON public.buses FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access drivers" ON public.drivers;
    CREATE POLICY "Public access drivers" ON public.drivers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access routes" ON public.routes;
    CREATE POLICY "Public access routes" ON public.routes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access bookings" ON public.bookings;
    CREATE POLICY "Public access bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access journeys" ON public.journeys;
    CREATE POLICY "Public access journeys" ON public.journeys FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access rescues" ON public.rescue_requests;
    CREATE POLICY "Public access rescues" ON public.rescue_requests FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access incidents" ON public.incidents;
    CREATE POLICY "Public access incidents" ON public.incidents FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access notifications" ON public.notifications;
    CREATE POLICY "Public access notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access preferences" ON public.user_preferences;
    CREATE POLICY "Public access preferences" ON public.user_preferences FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ====================================================================
-- REALTIME SUBSCRIPTIONS
-- ====================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles, public.buses, public.drivers, public.routes, public.bookings, public.journeys, public.rescue_requests, public.incidents, public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ====================================================================
-- FLEET & ROUTES DATA (Default Transit Network)
-- ====================================================================

INSERT INTO public.buses (id, name, plate, capacity, available, accessible, status, route_id) VALUES
    ('bus-101', 'Cedar 01', 'KA 03 MN 4821', 42, 18, true, 'Assigned', 'route-north'),
    ('bus-102', 'Fern 02', 'KA 03 MN 1904', 36, 9, true, 'Assigned', 'route-south'),
    ('bus-103', 'Canopy 03', 'KA 03 MN 7276', 40, 22, false, 'Available', NULL),
    ('bus-104', 'Meadow 04', 'KA 03 MN 6318', 32, 15, true, 'Available', NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    plate = EXCLUDED.plate,
    capacity = EXCLUDED.capacity,
    available = EXCLUDED.available,
    accessible = EXCLUDED.accessible,
    status = EXCLUDED.status,
    route_id = EXCLUDED.route_id;

INSERT INTO public.drivers (id, name, phone, bus_id, route_id, status) VALUES
    ('driver-1', 'Arjun Rao', '+91 98765 42018', 'bus-101', 'route-north', 'On duty'),
    ('driver-2', 'Meera Nair', '+91 98765 42027', 'bus-102', 'route-south', 'Available')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    bus_id = EXCLUDED.bus_id,
    route_id = EXCLUDED.route_id,
    status = EXCLUDED.status;

INSERT INTO public.routes (id, name, origin, destination, duration, bus_id, accessible, status, stops, schedule) VALUES
    ('route-north', 'North Loop', 'Lakeview Gate', 'Central Campus', 32, 'bus-101', true, 'Active',
     '[{"id":"s1","name":"Lakeview Gate","time":"07:40","sequence":1},{"id":"s2","name":"Pinecrest Hostel","time":"07:50","sequence":2},{"id":"s3","name":"Library Square","time":"08:02","sequence":3},{"id":"s4","name":"Central Campus","time":"08:12","sequence":4}]'::jsonb,
     '{"departure":"07:40","arrival":"08:12","days":["Weekdays"]}'::jsonb),
    ('route-south', 'South Connector', 'Market Circle', 'Central Campus', 26, 'bus-102', true, 'Active',
     '[{"id":"s5","name":"Market Circle","time":"08:05","sequence":1},{"id":"s6","name":"Botanical Road","time":"08:16","sequence":2},{"id":"s7","name":"Central Campus","time":"08:31","sequence":3}]'::jsonb,
     '{"departure":"08:05","arrival":"08:31","days":["Weekdays","Saturday"]}'::jsonb),
    ('route-east', 'East Residence Express', 'East Residence', 'Science Block', 18, 'bus-103', false, 'Active',
     '[{"id":"s8","name":"East Residence","time":"09:10","sequence":1},{"id":"s9","name":"Sports Pavilion","time":"09:20","sequence":2},{"id":"s10","name":"Science Block","time":"09:28","sequence":3}]'::jsonb,
     '{"departure":"09:10","arrival":"09:28","days":["Weekdays"]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    origin = EXCLUDED.origin,
    destination = EXCLUDED.destination,
    duration = EXCLUDED.duration,
    bus_id = EXCLUDED.bus_id,
    accessible = EXCLUDED.accessible,
    status = EXCLUDED.status,
    stops = EXCLUDED.stops,
    schedule = EXCLUDED.schedule;

INSERT INTO public.journeys (id, route_id, bus_id, status, date, completed_stops) VALUES
    ('journey-1', 'route-north', 'bus-101', 'Scheduled', CURRENT_DATE::text, 0),
    ('journey-2', 'route-south', 'bus-102', 'Boarding', CURRENT_DATE::text, 0)
ON CONFLICT (id) DO NOTHING;
