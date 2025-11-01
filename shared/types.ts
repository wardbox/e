export interface EndpointEvent {
  timestamp: Date;
  type: 'spawn' | 'success' | 'failure' | 'evolution' | 'check';
  health: number;
  message: string;
}

export interface Endpoint {
  path: string;
  code: string;
  health: number;
  uses: number;
  failures: number;
  lastError?: string;
  lastUsed: Date;
  isEvolving: boolean;
  prNumber?: number;
  desperation: number;
  timeline: EndpointEvent[];
}

export interface DramaEvent {
  timestamp: Date;
  type: 'spawn' | 'death' | 'evolution' | 'pr' | 'beg';
  path: string;
  message: string;
}
