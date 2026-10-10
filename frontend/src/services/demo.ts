import type { AppData, Booking, CampusRoute, NotificationItem, RescueRequest, Role, User } from '../types';

const KEY = 'routerakshak-demo-v1';
const today = new Date().toISOString().slice(0, 10);
const seed: AppData = {
  buses: [
    { id: 'bus-101', name: 'Cedar 01', plate: 'KA 03 MN 4821', capacity: 42, available: 18, accessible: true, status: 'Assigned', routeId: 'route-north' },
    { id: 'bus-102', name: 'Fern 02', plate: 'KA 03 MN 1904', capacity: 36, available: 9, accessible: true, status: 'Assigned', routeId: 'route-south' },
    { id: 'bus-103', name: 'Canopy 03', plate: 'KA 03 MN 7276', capacity: 40, available: 22, accessible: false, status: 'Available' },
    { id: 'bus-104', name: 'Meadow 04', plate: 'KA 03 MN 6318', capacity: 32, available: 15, accessible: true, status: 'Available' },
  ],
  drivers: [
    { id: 'driver-1', name: 'Arjun Rao', phone: '+91 98765 42018', busId: 'bus-101', routeId: 'route-north', status: 'On duty' },
    { id: 'driver-2', name: 'Meera Nair', phone: '+91 98765 42027', busId: 'bus-102', routeId: 'route-south', status: 'Available' },
  ],
  routes: [
    { id: 'route-north', name: 'North Loop', origin: 'Lakeview Gate', destination: 'Central Campus', duration: 32, busId: 'bus-101', accessible: true, status: 'Active', stops: [{ id: 's1', name: 'Lakeview Gate', time: '07:40', sequence: 1 }, { id: 's2', name: 'Pinecrest Hostel', time: '07:50', sequence: 2 }, { id: 's3', name: 'Library Square', time: '08:02', sequence: 3 }, { id: 's4', name: 'Central Campus', time: '08:12', sequence: 4 }], schedule: { departure: '07:40', arrival: '08:12', days: ['Weekdays'] } },
    { id: 'route-south', name: 'South Connector', origin: 'Market Circle', destination: 'Central Campus', duration: 26, busId: 'bus-102', accessible: true, status: 'Active', stops: [{ id: 's5', name: 'Market Circle', time: '08:05', sequence: 1 }, { id: 's6', name: 'Botanical Road', time: '08:16', sequence: 2 }, { id: 's7', name: 'Central Campus', time: '08:31', sequence: 3 }], schedule: { departure: '08:05', arrival: '08:31', days: ['Weekdays', 'Saturday'] } },
    { id: 'route-east', name: 'East Residence Express', origin: 'East Residence', destination: 'Science Block', duration: 18, busId: 'bus-103', accessible: false, status: 'Active', stops: [{ id: 's8', name: 'East Residence', time: '09:10', sequence: 1 }, { id: 's9', name: 'Sports Pavilion', time: '09:20', sequence: 2 }, { id: 's10', name: 'Science Block', time: '09:28', sequence: 3 }], schedule: { departure: '09:10', arrival: '09:28', days: ['Weekdays'] } },
  ],
  bookings: [
    { id: 'booking-1', reference: 'RR-48291', userId: 'student-1', routeId: 'route-north', busId: 'bus-101', date: today, status: 'Upcoming', createdAt: new Date().toISOString() },
  ],
  journeys: [
    { id: 'journey-1', routeId: 'route-north', busId: 'bus-101', status: 'Scheduled', date: today, completedStops: 0 },
    { id: 'journey-2', routeId: 'route-south', busId: 'bus-102', status: 'Boarding', date: today, completedStops: 0 },
  ],
  rescues: [], incidents: [],
  notifications: [
    { id: 'notice-1', userId: 'student-1', title: 'Welcome aboard', message: 'Explore campus routes and plan your first safe journey.', createdAt: new Date().toISOString(), read: false },
    { id: 'notice-2', userId: 'admin-1', title: 'Fleet ready', message: 'Two replacement buses are currently available in the demo fleet.', createdAt: new Date().toISOString(), read: false },
    { id: 'notice-3', userId: 'driver-1', title: 'Route assigned', message: 'North Loop is on your schedule today.', createdAt: new Date().toISOString(), read: false },
  ],
  preferences: {},
};

export function readData(): AppData {
  try {
    const saved = localStorage.getItem(KEY);
    const fresh = JSON.parse(JSON.stringify(seed)) as AppData;
    return saved ? { ...fresh, ...JSON.parse(saved) as Partial<AppData> } : fresh;
  } catch { return JSON.parse(JSON.stringify(seed)) as AppData; }
}
export function writeData(data: AppData): void { localStorage.setItem(KEY, JSON.stringify(data)); window.dispatchEvent(new Event('routerakshak-change')); }
export function resetData(): void { localStorage.removeItem(KEY); window.dispatchEvent(new Event('routerakshak-change')); }
export function currentUser(): User | null {
  try { const value = localStorage.getItem('routerakshak-user'); return value ? JSON.parse(value) as User : null; } catch { return null; }
}
export function demoLogin(role: Role): User {
  const users: Record<Role, User> = {
    student: { id: 'student-1', name: 'Aanya Sharma', email: 'aanya@campus.demo', role: 'student' },
    driver: { id: 'driver-1', name: 'Arjun Rao', email: 'arjun@campus.demo', role: 'driver', phone: '+91 98765 42018' },
    admin: { id: 'admin-1', name: 'Kavya Menon', email: 'kavya@campus.demo', role: 'admin' },
  };
  const user = users[role]; localStorage.setItem('routerakshak-user', JSON.stringify(user)); return user;
}
export function logout(): void { localStorage.removeItem('routerakshak-user'); }
export function addNotification(userId: string, title: string, message: string): void {
  const data = readData(); data.notifications.unshift({ id: `notice-${Date.now()}`, userId, title, message, createdAt: new Date().toISOString(), read: false }); writeData(data);
}
export function createBooking(route: CampusRoute, date: string, userId: string): Booking {
  const data = readData(); const reference = `RR-${Math.floor(10000 + Math.random() * 89999)}`;
  const booking: Booking = { id: `booking-${Date.now()}`, reference, userId, routeId: route.id, busId: route.busId, date, status: 'Upcoming', createdAt: new Date().toISOString() };
  data.bookings.unshift(booking);
  const bus = data.buses.find(item => item.id === route.busId); if (bus && bus.available > 0) bus.available -= 1;
  data.notifications.unshift({ id: `notice-${Date.now()}`, userId, title: 'Seat booked', message: `Your ${route.name} journey is confirmed in demo mode. Reference ${reference}.`, createdAt: new Date().toISOString(), read: false });
  writeData(data); return booking;
}
export function cancelBooking(id: string): void {
  const data = readData(); const booking = data.bookings.find(item => item.id === id);
  if (booking && booking.status === 'Upcoming') { booking.status = 'Cancelled'; const bus = data.buses.find(item => item.id === booking.busId); if (bus) bus.available = Math.min(bus.capacity, bus.available + 1); }
  writeData(data);
}
export function createRescue(input: Pick<RescueRequest, 'userId' | 'routeId' | 'category' | 'description' | 'source'> & { bookingId?: string; requestReplacement?: boolean }): RescueRequest {
  const data = readData();
  const rescue: RescueRequest = { ...input, id: `rescue-${Date.now()}`, status: input.requestReplacement ? 'Replacement Requested' : 'Submitted', createdAt: new Date().toISOString(), notes: ['Request received in local demo workspace.'], };
  data.rescues.unshift(rescue);
  data.notifications.unshift({ id: `notice-${Date.now()}-a`, userId: 'admin-1', title: 'New rescue request', message: `${input.source} reported a ${input.category.toLowerCase()} on ${data.routes.find(r => r.id === input.routeId)?.name ?? 'a route'}.`, createdAt: new Date().toISOString(), read: false });
  if (input.userId !== 'admin-1') data.notifications.unshift({ id: `notice-${Date.now()}-u`, userId: input.userId, title: 'Rescue request submitted', message: 'Your request is with the transport team. No emergency services have been contacted.', createdAt: new Date().toISOString(), read: false });
  writeData(data); return rescue;
}
export function assignReplacement(rescueId: string, busId: string): boolean {
  const data = readData(); const bus = data.buses.find(item => item.id === busId && item.status === 'Available');
  const rescue = data.rescues.find(item => item.id === rescueId);
  if (!bus || !rescue) return false;
  bus.status = 'Assigned'; bus.available = Math.max(0, bus.available - 1); rescue.replacementBusId = bus.id; rescue.status = 'Replacement Assigned';
  rescue.notes.unshift(`Replacement ${bus.name} assigned by transport admin.`);
  data.notifications.unshift({ id: `notice-${Date.now()}-s`, userId: rescue.userId, title: 'Replacement assigned', message: `${bus.name} has been assigned to your rescue request.`, createdAt: new Date().toISOString(), read: false });
  data.notifications.unshift({ id: `notice-${Date.now()}-d`, userId: 'admin-1', title: 'Replacement dispatched in demo', message: `${bus.name} is attached to case ${rescue.id}.`, createdAt: new Date().toISOString(), read: false });
  writeData(data); return true;
}
export function updateRescueStatus(id: string, status: RescueRequest['status'], note = ''): void {
  const data = readData(); const rescue = data.rescues.find(item => item.id === id);
  if (rescue) { rescue.status = status; if (note) rescue.notes.unshift(note); data.notifications.unshift({ id: `notice-${Date.now()}`, userId: rescue.userId, title: 'Rescue case updated', message: `Your case status is now ${status}.`, createdAt: new Date().toISOString(), read: false }); }
  writeData(data);
}
export function markNotificationRead(id: string): void { const data = readData(); const n = data.notifications.find(item => item.id === id); if (n) n.read = true; writeData(data); }
