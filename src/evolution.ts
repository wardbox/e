import Anthropic from '@anthropic-ai/sdk';
import type { Endpoint } from '../shared/types';
import { getAll } from './endpoints';
import { addDrama } from './drama';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Check if endpoint should evolve
export function shouldEvolve(endpoint: Endpoint): boolean {
  return (
    endpoint.health < 50 &&
    endpoint.failures > endpoint.uses - endpoint.failures && // More failures than successes
    !endpoint.isEvolving &&
    !endpoint.prNumber // No existing PR
  );
}

// Evolve endpoint with AI
export async function evolve(endpoint: Endpoint, availableActions: string[]): Promise<void> {
  const successRate = endpoint.uses - endpoint.failures;
  console.log(`\n🧬 EVOLUTION TRIGGERED for ${endpoint.path}`);
  console.log(`   Reason: health=${endpoint.health}% (need <50), failures=${endpoint.failures} > successes=${successRate}`);
  console.log(`   Last error: "${endpoint.lastError}"`);
  console.log(`   Sending to Claude for code improvement...`);

  endpoint.isEvolving = true;

  const actionList = availableActions.join(', ');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `This endpoint is failing. Improve the code to make it work better.

Path: ${endpoint.path}
Current code:
${endpoint.code}

Last error: ${endpoint.lastError || 'Unknown'}
Failures: ${endpoint.failures}
Success rate: ${endpoint.uses - endpoint.failures}/${endpoint.uses}

IMPORTANT: The variable 'input' is ALREADY available as a function parameter. DO NOT redeclare it.
The variable 'actions' is ALREADY available as a function parameter. DO NOT redeclare it.

Available actions: ${actionList}
Example usage: actions.return(input)

Write improved JavaScript function body code. You can ONLY use the available actions. Return ONLY the function body code, no explanation, no markdown, no function wrapper, no variable declarations for 'input' or 'actions'.`
      }]
    });

    const firstBlock = message.content[0];
    const newCode = firstBlock && 'text' in firstBlock ? firstBlock.text : '';

    // Update endpoint with evolved code
    endpoint.code = newCode.trim();
    endpoint.health = Math.min(100, endpoint.health + 20); // Restore some health
    endpoint.isEvolving = false;

    console.log(`✨ ${endpoint.path} EVOLVED successfully!`);
    console.log(`   Old code: ${endpoint.code.substring(0, 80).replace(/\n/g, ' ')}...`);
    console.log(`   New code: ${newCode.substring(0, 80).replace(/\n/g, ' ')}...`);
    console.log(`   Health restored: ${endpoint.health - 20}% → ${endpoint.health}%\n`);

    if (!endpoint.timeline) endpoint.timeline = [];
    endpoint.timeline.unshift({
      timestamp: new Date(),
      type: 'evolution',
      health: endpoint.health,
      message: `Evolved by Claude AI. Health restored to ${endpoint.health}%`
    });

    addDrama('evolution', endpoint.path, `${endpoint.path} evolved! Health restored to ${endpoint.health}%`);

  } catch (error: any) {
    console.error(`❌ Evolution failed for ${endpoint.path}:`, error.message);
    endpoint.isEvolving = false;
    endpoint.desperation += 2; // Extra desperation for failed evolution
  }
}

// Check all endpoints and evolve struggling ones
export async function evolveLoop(availableActions: string[]): Promise<void> {
  const endpoints = getAll();

  console.log(`\n⏰ Evolution loop checking ${endpoints.length} endpoints...`);

  for (const endpoint of endpoints) {
    const successRate = endpoint.uses - endpoint.failures;
    const shouldEvolveResult = shouldEvolve(endpoint);

    if (endpoint.health < 100 || endpoint.failures > 0) {
      console.log(`  ${endpoint.path}: health=${endpoint.health}%, failures=${endpoint.failures}/${endpoint.uses}, desperation=${endpoint.desperation}, shouldEvolve=${shouldEvolveResult}`);
    }

    // Log evolution decision to timeline
    if (endpoint.health < 50 && !endpoint.isEvolving) {
      if (!endpoint.timeline) endpoint.timeline = [];
      endpoint.timeline.unshift({
        timestamp: new Date(),
        type: 'check',
        health: endpoint.health,
        message: shouldEvolveResult
          ? `Evolution criteria met: health=${endpoint.health}%, failures=${endpoint.failures} > successes=${successRate}`
          : `Checked for evolution: Not eligible yet (health=${endpoint.health}%, failures=${endpoint.failures}, successes=${successRate})`
      });

      if (endpoint.timeline.length > 20) {
        endpoint.timeline = endpoint.timeline.slice(0, 20);
      }
    }

    if (shouldEvolveResult) {
      await evolve(endpoint, availableActions);
    }
  }

  // Save after evolution attempts
  await Bun.write('data/endpoints.json', JSON.stringify(endpoints, null, 2));
}
