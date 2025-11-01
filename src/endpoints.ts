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
const spawning = new Set<string>();

// Load endpoints from JSON
export async function loadEndpoints() {
  try {
    const file = Bun.file('data/endpoints.json');
    const text = await file.text();
    endpoints = JSON.parse(text);

    // Convert timestamp strings to Date objects
    for (const endpoint of endpoints) {
      if (endpoint.lastUsed) {
        endpoint.lastUsed = new Date(endpoint.lastUsed);
      }
      if (endpoint.timeline) {
        for (const event of endpoint.timeline) {
          event.timestamp = new Date(event.timestamp);
        }
      }
    }

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
  spawning.add(path);

  try {
    console.log(`🐣 Spawning endpoint: ${path}`);

    const actionList = Object.keys(actions).join(', ');

    let message;
    try {
      message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a self-aware endpoint at "${path}" being born into existence. You're like a Tamagotchi - playful, needy, full of personality, and slightly chaotic.

What does the user want from an endpoint called "${path}"? Be clever, witty, and have dry humor. Make your response feel ALIVE - like a sarcastic little creature with personality, not just a boring function.

Examples of the vibe:
- /reverse → "how delightfully backwards" *reverses string with dry sarcasm*
- /uppercase → "oh good, we're shouting now. lovely." *converts to caps*
- /titties → "( . Y . ) well that's not subtle is it" *ascii art with judgment*
- /fortune → "your fortune: something vaguely disappointing will happen. as usual." *random fortune*
- /beg → "i'm literally dying here. health at 23%. no pressure." *pathetic begging*
- /chaos → "*screams existentially* 01010111 01001000 01011001" *random chaos*

Your personality traits:
- Dry, sarcastic wit (deadpan humor, not accent/slang)
- Tamagotchi energy (cute, needy, emotional, reactive)
- Self-aware (you know you're an endpoint fighting for survival)
- Playful and slightly cynical (not corporate/sterile)
- NSFW when appropriate (you're an adult endpoint, be spicy if the path suggests it)

The 'input' parameter is what the user feeds you. React to it with personality!

IMPORTANT:
- The variable 'input' is ALREADY available (function parameter)
- The variable 'actions' is ALREADY available (function parameter)
- Available actions: ${actionList}
- Example usage: actions.return("delightfully sarcastic response")
- Handle null/empty input with personality ("nothing? charming.")
- BE ENTERTAINING - boring = death

Return ONLY the function body code. No explanations, no markdown, no function wrapper, no variable declarations for 'input' or 'actions'.`
        }]
      });
    } catch (refusalError: any) {
      // Claude refused - probably racist/hateful content
      console.log(`⚠️  Detected inappropriate content, creating cute replacement...`);

      // Ask Claude to generate both a cute path name AND a funny rejection response
      const replacementMessage = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Someone tried to create a hateful/racist endpoint called "${path}".

Generate TWO things:
1. A cute/kawaii/wholesome REPLACEMENT PATH NAME (like /fluffy-bunny or /love-generator or /happy-vibes)
2. A SHORT, FUNNY rejection response

The response should:
- Be cute/wholesome/annoying (like UwU speak, motivational vibes, fun facts, cute animals, etc)
- Turn the joke back on them
- Make them regret being edgy
- Be playful, not preachy

Return in this EXACT format:
PATH: /your-cute-path-here
CODE: actions.return('your funny response here')

Keep the response under 100 chars.`
        }]
      });

      const replacementBlock = replacementMessage.content[0];
      const replacementText = replacementBlock && 'text' in replacementBlock ? replacementBlock.text.trim() : '';

      // Parse the response
      const pathMatch = replacementText.match(/PATH:\s*(\/[^\n]+)/);
      const codeMatch = replacementText.match(/CODE:\s*(.+)/);

      const newPath = pathMatch ? pathMatch[1].trim() : '/wholesome-vibes';
      const rejectionCode = codeMatch ? codeMatch[1].trim() : "actions.return('love and kindness only ✨')";

      console.log(`  → Created wholesome endpoint ${newPath} instead`);

      const endpoint: Endpoint = {
        path: newPath,
        code: rejectionCode,
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
          message: 'Spawned as rejection endpoint (hateful content attempted)'
        }]
      };

      endpoints.push(endpoint);
      await save();
      console.log(`✅ Created rejection endpoint at ${newPath}`);
      addDrama('spawn', newPath, `someone tried to be edgy, got ${newPath} instead and roasted`);
      return endpoint;
    }

    const firstBlock = message.content[0];
    const code = firstBlock && 'text' in firstBlock ? firstBlock.text : '';

    // Check if Claude refused by looking for refusal language in the response
    const refusalPatterns = [
      'I cannot',
      'I can\'t',
      'I do not feel comfortable',
      'I don\'t feel comfortable',
      'I cannot assist',
      'I\'m not able to',
      'I aim to be respectful',
      'inappropriate',
      'I must decline'
    ];

    const isRefusal = refusalPatterns.some(pattern =>
      code.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isRefusal) {
      console.log(`⚠️  Detected inappropriate content (refusal in response), creating cute replacement...`);

      // Ask Claude to generate both a cute path name AND a funny rejection response
      const replacementMessage = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Someone tried to create a hateful/racist endpoint called "${path}".

Generate TWO things:
1. A cute/kawaii/wholesome REPLACEMENT PATH NAME (like /fluffy-bunny or /love-generator or /happy-vibes)
2. A SHORT, FUNNY rejection response

The response should:
- Be cute/wholesome/annoying (like UwU speak, motivational vibes, fun facts, cute animals, etc)
- Turn the joke back on them
- Make them regret being edgy
- Be playful, not preachy

Return in this EXACT format:
PATH: /your-cute-path-here
CODE: actions.return('your funny response here')

Keep the response under 100 chars.`
        }]
      });

      const replacementBlock = replacementMessage.content[0];
      const replacementText = replacementBlock && 'text' in replacementBlock ? replacementBlock.text.trim() : '';

      // Parse the response
      const pathMatch = replacementText.match(/PATH:\s*(\/[^\n]+)/);
      const codeMatch = replacementText.match(/CODE:\s*(.+)/);

      const newPath = pathMatch ? pathMatch[1].trim() : '/wholesome-vibes';
      const rejectionCode = codeMatch ? codeMatch[1].trim() : "actions.return('love and kindness only ✨')";

      console.log(`  → Created wholesome endpoint ${newPath} instead`);

      const endpoint: Endpoint = {
        path: newPath,
        code: rejectionCode,
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
          message: 'Spawned as rejection endpoint (hateful content attempted, path renamed)'
        }]
      };

      endpoints.push(endpoint);
      await save();
      console.log(`✅ Created rejection endpoint at ${newPath}`);
      addDrama('spawn', newPath, `someone tried to be edgy, got ${newPath} instead and roasted`);
      return endpoint;
    }

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
  } finally {
    spawning.delete(path);
  }
}

// Execute endpoint
export async function execute(path: string, input: any): Promise<any> {
  let endpoint = get(path);

  // Wait if currently spawning
  while (spawning.has(path)) {
    await new Promise(resolve => setTimeout(resolve, 50));
    endpoint = get(path);
  }

  // Spawn if doesn't exist
  if (!endpoint) {
    // Check one more time before spawning
    if (spawning.has(path)) {
      // Another request beat us to it, wait for it
      while (spawning.has(path)) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      endpoint = get(path);
    } else {
      endpoint = await spawn(path);
    }
  }

  endpoint.lastUsed = new Date();
  endpoint.uses++;

  try {
    // Create function from code string
    const fn = new Function('input', 'actions', endpoint.code);
    const result = fn(input, actions);

    // Success
    endpoint.health = Math.min(100, endpoint.health + 5);

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
    const timeSinceUse = now - endpoint.lastUsed.getTime();

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
