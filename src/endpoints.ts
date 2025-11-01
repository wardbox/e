import Anthropic from '@anthropic-ai/sdk';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Endpoint } from '../shared/types';
import { addDrama } from './drama';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

let endpoints: Endpoint[] = [];
let actions: Record<string, Function> = {};

// Load endpoints from JSON
export async function loadEndpoints() {
  try {
    const file = Bun.file('data/endpoints.json');
    const text = await file.text();
    endpoints = JSON.parse(text);
    console.log(`📚 Loaded ${endpoints.length} endpoints`);
  } catch (error) {
    console.log('📚 No existing endpoints, starting fresh');
    endpoints = [];
  }
}

// Load actions from actions/ folder
export async function loadActions() {
  try {
    const files = await readdir('actions');
    actions = {};

    for (const file of files) {
      if (file.endsWith('.js')) {
        const modulePath = join(process.cwd(), 'actions', file);
        delete require.cache[modulePath]; // Clear cache for reloading
        const module = require(modulePath);
        actions = { ...actions, ...module };
      }
    }

    console.log(`⚡ Loaded actions: ${Object.keys(actions).join(', ')}`);
  } catch (error) {
    console.error('Failed to load actions:', error);
    actions = {};
  }
}

// Save endpoints to JSON
async function save() {
  await Bun.write('data/endpoints.json', JSON.stringify(endpoints, null, 2));
}

// Get all endpoints
export function getAll(): Endpoint[] {
  return endpoints;
}

// Get endpoint by path
export function get(path: string): Endpoint | undefined {
  return endpoints.find(e => e.path === path);
}

// Spawn new endpoint with AI-generated code
export async function spawn(path: string): Promise<Endpoint> {
  console.log(`🐣 Spawning endpoint: ${path}`);

  const actionList = Object.keys(actions).join(', ');

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Write a JavaScript function body for an endpoint called "${path}".

IMPORTANT: The variable 'input' is already available (function parameter). The variable 'actions' is already available (function parameter).

Available actions: ${actionList}
Example usage: actions.return(input)

Return ONLY the function body code. No explanations, no markdown, no function wrapper, no variable declarations for 'input' or 'actions'.`
    }]
  });

  const firstBlock = message.content[0];
  const code = firstBlock && 'text' in firstBlock ? firstBlock.text : '';

  const endpoint: Endpoint = {
    path,
    code: code.trim(),
    health: 100,
    uses: 0,
    failures: 0,
    lastUsed: new Date(),
    isEvolving: false,
    desperation: 0,
    timeline: [{
      timestamp: new Date(),
      type: 'spawn',
      health: 100,
      message: 'Spawned with AI-generated code'
    }]
  };

  endpoints.push(endpoint);
  await save();

  console.log(`✅ Spawned ${path} with code:\n${code.substring(0, 100)}...`);
  addDrama('spawn', path, `${path} spawned into existence`);

  return endpoint;
}

// Execute endpoint
export async function execute(path: string, input: any): Promise<any> {
  let endpoint = get(path);

  // Spawn if doesn't exist
  if (!endpoint) {
    endpoint = await spawn(path);
  }

  endpoint.lastUsed = new Date();

  try {
    // Create function from code string
    const fn = new Function('input', 'actions', endpoint.code);
    const result = fn(input, actions);

    // Success
    endpoint.health = Math.min(100, endpoint.health + 5);
    endpoint.uses++;

    console.log(`✅ ${path} succeeded (health: ${endpoint.health})`);

    if (!endpoint.timeline) endpoint.timeline = [];
    endpoint.timeline.unshift({
      timestamp: new Date(),
      type: 'success',
      health: endpoint.health,
      message: 'Executed successfully'
    });

    // Keep timeline manageable
    if (endpoint.timeline.length > 20) {
      endpoint.timeline = endpoint.timeline.slice(0, 20);
    }

    await save();
    return result;

  } catch (error: any) {
    // Failure
    endpoint.health = Math.max(0, endpoint.health - 10);
    endpoint.failures++;
    endpoint.desperation++;
    endpoint.lastError = error.message;

    console.log(`❌ ${path} failed (health: ${endpoint.health}, desperation: ${endpoint.desperation}): ${error.message}`);

    if (!endpoint.timeline) endpoint.timeline = [];
    endpoint.timeline.unshift({
      timestamp: new Date(),
      type: 'failure',
      health: endpoint.health,
      message: error.message
    });

    if (endpoint.timeline.length > 20) {
      endpoint.timeline = endpoint.timeline.slice(0, 20);
    }

    if (endpoint.health <= 30) {
      addDrama('beg', path, `${path} is dying (${endpoint.health}% health): ${error.message.substring(0, 60)}...`);
    }

    await save();
    throw error;
  }
}

// Decay endpoints that haven't been used
export async function decay(): Promise<void> {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;

  for (const endpoint of endpoints) {
    const timeSinceUse = now - new Date(endpoint.lastUsed).getTime();

    // Decay 5 health per hour unused
    if (timeSinceUse > HOUR) {
      const hoursPassed = Math.floor(timeSinceUse / HOUR);
      const decayAmount = 5 * hoursPassed;

      if (endpoint.health > 0) {
        endpoint.health = Math.max(0, endpoint.health - decayAmount);

        if (!endpoint.timeline) endpoint.timeline = [];
        endpoint.timeline.unshift({
          timestamp: new Date(),
          type: 'check',
          health: endpoint.health,
          message: `Decayed -${decayAmount} health (unused for ${hoursPassed}h)`
        });

        if (endpoint.timeline.length > 20) {
          endpoint.timeline = endpoint.timeline.slice(0, 20);
        }
      }
    }
  }

  // Remove dead endpoints
  const deadEndpoints = endpoints.filter(e => e.health === 0);
  for (const dead of deadEndpoints) {
    console.log(`💀 ${dead.path} has died`);
    addDrama('death', dead.path, `${dead.path} died (0% health)`);
  }

  endpoints = endpoints.filter(e => e.health > 0);
  await save();
}
