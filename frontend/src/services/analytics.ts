import { readData } from './demo';

export function getAnalyticsSnapshot() {
  const data = readData();
  return {
    activeRoutes: data.routes.filter(route => route.status === 'Active').length,
    fleetAvailable: data.buses.filter(bus => bus.status === 'Available').length,
    upcomingBookings: data.bookings.filter(booking => booking.status === 'Upcoming').length,
    openRescues: data.rescues.filter(rescue => !['Resolved', 'Closed'].includes(rescue.status)).length,
    sampleOccupancy: [
      { period: '07–08', north: 54, south: 39 },
      { period: '08–09', north: 77, south: 68 },
      { period: '09–10', north: 57, south: 52 },
      { period: '10–11', north: 35, south: 41 },
    ],
  };
}
