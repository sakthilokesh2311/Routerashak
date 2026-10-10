import type { CampusRoute } from '../types';
import { readData } from './demo';

export function listRoutes(): CampusRoute[] {
  return readData().routes;
}
