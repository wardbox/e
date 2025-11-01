import type { DramaEvent } from '../shared/types';

let events: DramaEvent[] = [];
const MAX_EVENTS = 50;

export function addDrama(type: DramaEvent['type'], path: string, message: string) {
  events.unshift({
    timestamp: new Date(),
    type,
    path,
    message
  });

  // Keep only recent events
  if (events.length > MAX_EVENTS) {
    events = events.slice(0, MAX_EVENTS);
  }

  console.log(`📢 ${message}`);
}

export function getEvents(): DramaEvent[] {
  return events;
}

export function clearEvents() {
  events = [];
}
