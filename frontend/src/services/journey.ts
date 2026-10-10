import type { Journey } from '../types';
import { readData, writeData } from './demo';

const allowed: Record<Journey['status'], Journey['status'][]> = {
  Scheduled: ['Boarding'],
  Boarding: ['In Transit', 'Delayed'],
  'In Transit': ['Delayed', 'Completed'],
  Delayed: ['In Transit', 'Completed'],
  Completed: [],
};

export function updateJourneyStatus(routeId: string, status: Journey['status']): boolean {
  const data = readData();
  const journey = data.journeys.find(item => item.routeId === routeId);
  if (!journey || !allowed[journey.status].includes(status)) return false;
  journey.status = status;
  writeData(data);
  return true;
}
