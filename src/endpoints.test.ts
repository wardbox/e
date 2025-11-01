import { test, expect, beforeEach } from "bun:test";
import { spawn, execute, getAll, loadActions } from './endpoints';
import { shouldEvolve } from './evolution';

beforeEach(async () => {
  await loadActions();
});

test("spawn creates endpoint with 100 health", async () => {
  const endpoint = await spawn('/test-spawn');

  expect(endpoint.path).toBe('/test-spawn');
  expect(endpoint.health).toBe(100);
  expect(endpoint.uses).toBe(0);
  expect(endpoint.failures).toBe(0);
  expect(endpoint.code).toBeTruthy();
});

test("successful execution increases health", async () => {
  const endpoint = await spawn('/test-success');
  const initialHealth = endpoint.health;

  await execute('/test-success', 'test input');

  const updated = getAll().find(e => e.path === '/test-success');
  expect(updated?.health).toBeGreaterThanOrEqual(initialHealth);
  expect(updated?.uses).toBe(1);
  expect(updated?.failures).toBe(0);
});

test("failed execution decreases health", async () => {
  const endpoint = await spawn('/test-fail');

  // Force broken code that will fail
  endpoint.code = 'input.doesNotExist.willCrash()';

  // Execute to trigger failure
  try {
    await execute('/test-fail', 'test');
  } catch (e) {
    // Expected to fail
  }

  const updated = getAll().find(e => e.path === '/test-fail');
  expect(updated?.health).toBeLessThan(100);
  expect(updated?.failures).toBeGreaterThan(0);
});

test("evolution triggers when health < 50 and failures > successes", async () => {
  const endpoint = await spawn('/test-evolve');

  // Manually set conditions for evolution
  endpoint.health = 40;
  endpoint.failures = 10;
  endpoint.uses = 15; // 15 uses, 10 failures = 5 successes
  endpoint.isEvolving = false;

  expect(shouldEvolve(endpoint)).toBe(true);
});

test("evolution does not trigger when health is high", async () => {
  const endpoint = await spawn('/test-no-evolve');

  endpoint.health = 80;
  endpoint.failures = 2;
  endpoint.uses = 10;
  endpoint.isEvolving = false;

  expect(shouldEvolve(endpoint)).toBe(false);
});
