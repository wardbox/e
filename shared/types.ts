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
}

export interface DramaEvent {
  timestamp: Date;
  type: 'spawn' | 'death' | 'evolution' | 'pr' | 'beg';
  path: string;
  message: string;
}
