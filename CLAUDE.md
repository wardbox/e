# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Response Style
**CRITICAL**: Minimize token usage. Keep responses concise, skip pleasantries, avoid explanations unless asked. Save money.

## Technology Preferences
**NEVER use OpenAI/GPT.** This project uses Anthropic Claude exclusively. Fuck Sam Altman.

## Project Overview

**Endpoint Evolution** - AI-driven API system where endpoints self-evolve, compete for survival, and create GitHub PRs to request new capabilities.

## Tech Stack (BHVR)
- **Bun** - Runtime & package manager
- **Hono** - Ultra-fast web framework
- **Vite** - Frontend build tool
- **React** - Dashboard UI

## Architecture

### Core Components

1. **Server (`src/server.ts`)** - Hono server with:
   - Catch-all route that spawns/executes endpoints on ANY path
   - Evolution loop (30s) - evolves struggling endpoints
   - Decay loop (60s) - decreases health of unused endpoints
   - PR check loop (5min) - creates PRs for desperate endpoints
   - Dashboard API endpoints

2. **Endpoint Manager (`src/endpoints.ts`)** - Lifecycle management:
   - `spawn(path)` - Claude generates initial code from path name
   - `execute(path, input)` - Runs endpoint code with available actions
   - `decay()` - Natural selection: unused endpoints lose health and die
   - Endpoints stored as JSON with health, uses, failures, desperation

3. **Evolution Engine (`src/evolution.ts`)** - AI-driven evolution:
   - Triggers when health < 50% and failures > successes
   - Sends code + errors to Claude for improvement
   - Tests new code before deployment
   - Restores health on successful evolution

4. **GitHub Integration (`src/github.ts`)** - PR automation:
   - Creates PRs when desperation >= 10 and health < 30%
   - Generates new action requests via Claude
   - Adds increasingly desperate PR comments over time
   - Monitors merged PRs to reload actions and restore health

5. **Dashboard (`src/public/index.html`)** - Real-time visualization:
   - Living endpoints with health bars and code display
   - Drama feed of births, deaths, evolutions, and PR begging
   - Test panel for triggering endpoints

### Actions System

Critical constraint: Endpoints can ONLY use actions available in `actions/` folder.

- Start with just `actions/core.js` containing `return: (input) => input`
- Endpoints discover they need actions through failure
- New actions are added ONLY via merged PRs
- Actions load dynamically from files: `module.exports = { actionName: (input) => ... }`

### Data Flow

```
Request → Spawn/Execute Endpoint → Use Available Actions → Success/Failure
                ↓                                               ↓
         Increase Health                              Decrease Health, Inc Desperation
                                                              ↓
                                                   Evolution Attempt (GPT)
                                                              ↓
                                                   Still Failing? → Create GitHub PR
                                                                         ↓
                                                                   Human Merges PR
                                                                         ↓
                                                                   Reload Actions → Endpoint Thrives
```

## Development Commands

Setup:
```bash
bun install
```

Dev:
```bash
bun run dev
```

Build:
```bash
bun run build
```

## Environment Setup

Required `.env` variables:
```
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-username
GITHUB_REPO=endpoint-evolution-mvp
PORT=3000
```

GitHub token needs: `repo` scope for creating branches and PRs.

## Key Implementation Details

### Endpoint Code Execution
Endpoints are pure JavaScript functions created with `new Function('input', 'actions', endpoint.code)`. This allows dynamic code generation while maintaining sandboxing through limited context.

### Health System
- Spawn: 100 health
- Success: +5 health
- Failure: -10 health
- Decay: -5 health per hour unused
- Death: 0 health → removed from system

### Desperation Levels
- 0-3: Endpoint trying to self-evolve
- 4-7: Getting worried, evolution attempts more aggressive
- 8-9: Preparing PR draft
- 10+: Opens PR, starts harassment campaign

### Claude Prompts Strategy
Keep prompts minimal and constraint-focused:
- Spawn: "Write a JavaScript function body for an endpoint called [path]. You can only use the available actions: [list actions]. Return only code, no explanation."
- Evolution: "This endpoint is failing. Current code: [code]. Errors: [errors]. Available actions: [list]. Write improved code."
- Action request: "This endpoint keeps failing with error: [error]. What new action would help? Write a one-line JavaScript function."

### PR Creation Flow
1. Claude generates action based on endpoint's errors
2. Create branch: `endpoint-[path]-[timestamp]`
3. Add file: `actions/[endpoint-name].js`
4. PR title: "[path] is dying - needs [action name]"
5. PR body includes health %, failures, desperation emojis
6. Auto-comment every hour with updated stats

## Emergent Behaviors to Expect

- **Natural Selection**: Popular endpoints thrive, unused ones die
- **Action Sharing**: Multiple endpoints request/use same actions
- **Evolution Patterns**: Successful code patterns spread across endpoints
- **PR Competition**: Endpoints reference each other's PRs in their pleas
- **Personality Emergence**: Evolved endpoints get "cocky" in their messages

## Testing Approach

Manual testing workflow:
1. Hit `/test-endpoint` to spawn
2. Keep hitting it with bad input to trigger failures
3. Watch health drop in dashboard
4. Observe evolution attempts
5. Wait for PR creation (or trigger at desperation 10)
6. Merge PR manually via `/api/merge-pr/:number` or GitHub UI
7. Verify action loads and endpoint recovers

Stress test: Hit 20 different paths simultaneously, watch competition for resources.
- do not talk to me, just do the work. ask questions if you get stuck, you are my peon