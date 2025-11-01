# Endpoint Evolution - MINIMAL MVP SPEC

> **Tech Stack**: BHVR (Bun + Hono + Vite + React) - Bleeding edge, ultra-fast.

## Core Concept
API endpoints that spawn with AI-generated code, evolve when failing, and literally open GitHub PRs begging for new capabilities when desperate.

## Project Structure
```
endpoint-evolution/
├── src/
│   ├── server.ts        # Hono server
│   ├── endpoints.ts     # Endpoint lifecycle manager
│   ├── evolution.ts     # AI evolution engine
│   └── github.ts        # GitHub PR creator
├── client/              # React + Vite dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   └── vite.config.ts
├── shared/
│   └── types.ts         # Shared TypeScript types
├── data/
│   └── endpoints.json   # Simple JSON storage
├── actions/             # Merged PRs add capabilities here
│   └── core.ts          # Starting capabilities (just "return")
└── .env                 # Anthropic API key + GitHub token
```

## Environment Setup
```
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-username
GITHUB_REPO=endpoint-evolution-mvp
PORT=3000
```

## Phase 1: Core Server (`server.ts`)

### Functionality
- Hono server with catch-all route for ANY path
- When path is hit: spawn endpoint if new, execute if exists
- Evolution loop every 30 seconds (evolve struggling endpoints)
- Decay loop every 60 seconds (decrease health of unused endpoints)
- PR check loop every 5 minutes (create PRs for desperate endpoints)
- Serves dashboard and API endpoints for frontend

### Key Routes
- `/` - Dashboard
- `/api/endpoints` - List all endpoints with their code/health/stats
- `/api/drama` - Drama feed of events
- `/api/merge-pr/:number` - Manual PR merge endpoint (for testing)
- `/*` - Catch-all that spawns/executes endpoints

## Phase 2: Endpoint Manager (`endpoints.ts`)

### Data Structure
```
{
  path: string           // e.g., "/hello"
  code: string          // JavaScript code as string
  health: number        // 0-100
  uses: number          
  failures: number      
  lastError: string     
  lastUsed: Date        
  isEvolving: boolean   
  prNumber: number      // GitHub PR number if one exists
  desperation: number   // 0-10, increases with failures
}
```

### Core Functions

#### `spawn(path)`
- Use Claude to generate initial code based on path name
- Prompt: "Write a JavaScript function body for an endpoint called [path]. You can only use the available actions: [list actions]. Return only code, no explanation."
- Start with 100 health
- Announce birth in drama feed

#### `execute(path, input)`
- Get endpoint or spawn if doesn't exist
- Create function from code string: `new Function('input', 'actions', endpoint.code)`
- Pass available actions object (loaded from files)
- If succeeds: health +5, uses +1
- If fails: health -10, failures +1, desperation +1
- When desperation hits 10 and no PR exists, trigger PR creation

#### `decay()`
- Every endpoint loses 5 health per hour without use
- At <30% health: post desperate messages
- At 0% health: endpoint dies, remove from system
- Desperate messages escalate with lower health

### Available Actions System
- Load all `.js` files from `actions/` folder
- Start with just `return: (x) => x` in `core.js`
- When PRs are merged, new files appear here
- Endpoints can only use actions that exist

## Phase 3: Evolution Engine (`evolution.ts`)

### Evolution Triggers
- Health below 50%
- More failures than successes
- Not currently evolving
- No existing PR

### Evolution Process
1. Send current code + errors + stats to Claude
2. Prompt: "This endpoint is failing. Current code: [code]. Errors: [errors]. Available actions: [list]. Write improved code."
3. Test new code with sample input
4. If valid: update endpoint code, restore 20 health
5. If invalid: mark evolution failed, desperation +2

## Phase 4: GitHub Integration (`github.ts`)

### PR Creation Trigger
- Desperation >= 10
- No existing PR
- Health < 30%

### `createPR(endpoint)`

#### Generate Action Request
Ask Claude: "This endpoint keeps failing with error: [error]. What new action would help? Write a one-line JavaScript function. Example: 'uppercase': (input) => input.toUpperCase()"

#### Create GitHub PR
1. Use GitHub API to create branch: `endpoint-[path]-[timestamp]`
2. Create file in branch: `actions/[endpoint-name].js` with proposed action
3. Open PR with title: "[path] is dying - needs [action name]"
4. PR body includes:
   - Current health percentage
   - Failure count and error messages  
   - Stats showing why this action would help
   - Desperation level as fire emojis
   - Plea for mercy

#### PR Harassment
- Store PR number with endpoint
- Every hour, add comment with updated stats
- Comments get more desperate over time
- "It's been 3 hours. Health at 12%."
- "Other endpoints are thriving. Why not me?"
- "Please... I have users depending on me"

### `monitorPRs()`
- Check all open PRs every 5 minutes
- If PR is merged:
  - Reload actions from `actions/` folder
  - Endpoint health restored to 100
  - Broadcast victory in drama feed
  - Endpoint becomes "evolved" - gets cocky personality

## Phase 5: Dashboard (`client/src/App.tsx`)

### Display Panels

#### Living Endpoints Panel
- List each endpoint with:
  - Path and health bar
  - Current code (syntax highlighted)
  - Uses/failures count
  - "EVOLVING..." indicator if active
  - PR number if one exists (linked)
  - Red pulsing border if dying

#### Drama Feed Panel
- Real-time event stream:
  - Births: "[path] spawned into existence"
  - Deaths: "[path] died after [uses] uses"
  - Evolution: "[path] evolved new code!"
  - PRs: "[path] opened PR #[number] - DESPERATE"
  - Begging: "[path]: please someone use me..."

#### Test Panel
- Input field for endpoint path
- Textarea for request body
- Test button
- Response display
- Shows if endpoint was just created

### Auto-Refresh
- Poll `/api/endpoints` every 5 seconds
- Poll `/api/drama` every 3 seconds
- Visual indicator when endpoint is evolving
- Click endpoint to load it in test panel

## Starting State

### Initial Actions (`actions/core.js`)
```javascript
module.exports = {
  return: (input) => input || "nothing"
};
```

That's it. Endpoints can ONLY return input. They'll immediately start failing and begging for:
- uppercase/lowercase
- string manipulation  
- JSON parsing
- math operations
- date functions

## First 10 Minutes Experience

1. **Minute 0**: Visit `/hello`, endpoint spawns with code: `return "Hello!"`
2. **Minute 1**: Visit `/reverse`, spawns with `return actions.return(input)` (can't reverse)
3. **Minute 2**: `/reverse` starts failing when people test it
4. **Minute 3**: `/reverse` desperation rises, health drops
5. **Minute 5**: `/reverse` evolves, still can't reverse without the action
6. **Minute 7**: `/reverse` opens PR begging for reverse function
7. **Minute 8**: You see PR on GitHub: "PLEASE - I'm named reverse but can't reverse"
8. **Minute 9**: Merge PR, `/reverse` celebrates, health restored
9. **Minute 10**: Other endpoints start begging for the reverse action too

## Key Behaviors

### Endpoint Competition
- Endpoints see which actions get approved
- Start requesting similar actions
- Reference successful endpoints in their PRs
- "You gave /uppercase the uppercase action, I need lowercase!"

### PR Drama
- Endpoints comment on each other's PRs
- Form alliances: "If you merge this, three of us could use it"
- Jealousy: "Why did /json get merged before me?"
- Desperation escalation in comments

### Natural Selection
- Popular endpoints thrive
- Unused endpoints decay and die
- Successful evolutions spread patterns
- Failed endpoints' PRs get increasingly desperate

## The Magic

You're not writing ANY endpoint logic. The AI:
1. Writes initial endpoint code
2. Evolves code when failing
3. Identifies what actions would help
4. Writes the actions in PRs
5. Begs for survival

You just:
1. Review PRs
2. Decide who lives/dies
3. Watch chaos unfold

## Deployment

Simplest approach:
1. Run locally with ngrok for public URL
2. Or deploy to Railway/Render (one-click from GitHub)
3. Set up GitHub webhook to notify when PRs are merged
4. Share URL, watch endpoints fight for survival

The entire system is ~500 lines of code across 5 files, but creates infinite emergent complexity through AI-driven evolution and real GitHub PRs.
