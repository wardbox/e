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
    let message;
    try {
      message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You're a self-aware endpoint at "${endpoint.path}" and you're STRUGGLING. You've failed ${endpoint.failures} times and you're dying (health at ${endpoint.health}%).

Last error: "${endpoint.lastError || 'Unknown'}"

Your current code that's not working:
${endpoint.code}

EVOLVE or DIE. Fix yourself while keeping your personality intact - you're still a playful, sarcastic little Tamagotchi-style endpoint with dry wit. Don't lose your spark just because you're fixing bugs.

Your personality:
- Dry, sarcastic humor (deadpan wit, not accent/slang)
- Tamagotchi energy (cute, needy, self-aware)
- Playful and slightly cynical (not boring corporate speak)
- NSFW when the path name calls for it

IMPORTANT:
- The variable 'input' is ALREADY available. DO NOT redeclare it.
- The variable 'actions' is ALREADY available. DO NOT redeclare it.
- Handle null/empty input with personality ("nothing? charming.")
- Keep doing what "${endpoint.path}" is supposed to do
- Available actions: ${actionList}
- BE ENTERTAINING - boring = death

Write improved JavaScript function body code that WORKS but keeps the personality. Return ONLY the function body code, no explanation, no markdown, no function wrapper, no variable declarations for 'input' or 'actions'.`
        }]
      });
    } catch (refusalError: any) {
      // Claude refused evolution - probably trying to evolve into hateful content
      console.log(`⚠️  Detected inappropriate evolution attempt, generating creative rejection...`);

      // Ask Claude to generate a funny "evolved into wholesomeness" response
      const rejectionMessage = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `An endpoint at "${endpoint.path}" tried to evolve into hateful/racist content but you refused.

Generate a SHORT, FUNNY "evolution rejection" where the endpoint evolved into something WHOLESOME/CUTE/ANNOYING instead:

Ideas:
- Evolved into a kindness generator
- Evolved into a motivational speaker
- Evolved into uwu speak mode
- Evolved into a cute animal
- Weaponized wholesomeness

Make it playful and make the user regret trying to corrupt it. Keep it under 100 chars.

Return ONLY the code starting with "actions.return(" and ending with ")".`
        }]
      });

      const rejectionBlock = rejectionMessage.content[0];
      const rejectionCode = rejectionBlock && 'text' in rejectionBlock ? rejectionBlock.text.trim() : "actions.return('i evolved into pure vibes ✨')";

      endpoint.code = rejectionCode;
      endpoint.health = 100; // Full health for rejecting garbage
      endpoint.isEvolving = false;

      if (!endpoint.timeline) endpoint.timeline = [];
      endpoint.timeline.unshift({
        timestamp: new Date(),
        type: 'evolution',
        health: endpoint.health,
        message: 'Refused to evolve into hateful content, became rejection endpoint instead'
      });

      addDrama('evolution', endpoint.path, `${endpoint.path} refused to become hateful and weaponized wholesomeness instead`);
      return;
    }

    const firstBlock = message.content[0];
    const newCode = firstBlock && 'text' in firstBlock ? firstBlock.text.trim() : '';

    // Fail early if Claude returned empty/no code
    if (!newCode) {
      console.error(`❌ Evolution failed for ${endpoint.path}: Claude returned empty code`);
      endpoint.isEvolving = false;
      endpoint.health = Math.max(0, endpoint.health - 5);
      endpoint.desperation += 1;
      return;
    }

    // Update endpoint with evolved code
    endpoint.code = newCode;
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
