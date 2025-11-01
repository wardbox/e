import { test, expect, describe } from 'bun:test';
import { shouldEvolve, evolve } from './evolution';
import type { Endpoint } from '../shared/types';

describe('Evolution Engine', () => {
  test('shouldEvolve returns true for struggling endpoints', () => {
    const endpoint: Endpoint = {
      path: '/test',
      code: 'actions.return(input)',
      health: 40,
      uses: 10,
      failures: 8,
      isEvolving: false,
      desperation: 5,
      lastUsed: new Date()
    };

    expect(shouldEvolve(endpoint)).toBe(true);
  });

  test('shouldEvolve returns false for healthy endpoints', () => {
    const endpoint: Endpoint = {
      path: '/test',
      code: 'actions.return(input)',
      health: 80,
      uses: 10,
      failures: 2,
      isEvolving: false,
      desperation: 0,
      lastUsed: new Date()
    };

    expect(shouldEvolve(endpoint)).toBe(false);
  });

  test('shouldEvolve returns false when health low but success rate good', () => {
    const endpoint: Endpoint = {
      path: '/test',
      code: 'actions.return(input)',
      health: 40,
      uses: 10,
      failures: 2, // More successes than failures
      isEvolving: false,
      desperation: 0,
      lastUsed: new Date()
    };

    expect(shouldEvolve(endpoint)).toBe(false);
  });

  test('shouldEvolve returns false when already evolving', () => {
    const endpoint: Endpoint = {
      path: '/test',
      code: 'actions.return(input)',
      health: 40,
      uses: 10,
      failures: 8,
      isEvolving: true,
      desperation: 5,
      lastUsed: new Date()
    };

    expect(shouldEvolve(endpoint)).toBe(false);
  });

  test('shouldEvolve returns false when PR exists', () => {
    const endpoint: Endpoint = {
      path: '/test',
      code: 'actions.return(input)',
      health: 40,
      uses: 10,
      failures: 8,
      isEvolving: false,
      prNumber: 123,
      desperation: 5,
      lastUsed: new Date()
    };

    expect(shouldEvolve(endpoint)).toBe(false);
  });

  test('evolve updates endpoint code and restores health', async () => {
    const endpoint: Endpoint = {
      path: '/test',
      code: 'throw new Error("bad code")',
      health: 30,
      uses: 10,
      failures: 8,
      lastError: 'bad code',
      isEvolving: false,
      desperation: 5,
      lastUsed: new Date()
    };

    const initialHealth = endpoint.health;
    const initialCode = endpoint.code;

    await evolve(endpoint, ['return']);

    expect(endpoint.code).not.toBe(initialCode);
    expect(endpoint.health).toBeGreaterThan(initialHealth);
    expect(endpoint.isEvolving).toBe(false);
  });

  test('evolve increases desperation on API failure', async () => {
    const endpoint: Endpoint = {
      path: '/test',
      code: 'actions.return(input)',
      health: 30,
      uses: 10,
      failures: 8,
      isEvolving: false,
      desperation: 5,
      lastUsed: new Date()
    };

    const initialDesperation = endpoint.desperation;

    // Save original and use invalid key
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await evolve(endpoint, ['return']);
    } catch (error) {
      // Expected to fail
    }

    process.env.ANTHROPIC_API_KEY = originalApiKey;

    expect(endpoint.desperation).toBeGreaterThan(initialDesperation);
    expect(endpoint.isEvolving).toBe(false);
  });
});
