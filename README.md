# Endpoint Evolution

> AI endpoints that spawn, evolve, and create GitHub PRs to survive

## Tech Stack (BHVR)

- **Bun** - Runtime & package manager
- **Hono** - Ultra-fast web framework
- **Vite** - Frontend build
- **React** - Dashboard UI
- **Tailwind v4** - Styling
- **shadcn/ui** - Components

## Quick Start

```bash
# Install
bun install

# Dev (both servers)
bun run dev              # Backend (Hono on :3000)
cd client && bun run dev  # Frontend (Vite on :5173)

# Build
bun run build
cd client && bun run build
```

## Environment

```bash
cp .env.example .env
# Add your OpenAI & GitHub tokens
```

## Structure

```
endpoint-evolution/
├── src/
│   └── server.ts       # Hono API server
├── client/
│   ├── src/           # React dashboard
│   └── vite.config.ts
└── shared/
    └── types.ts       # Shared types
```

## Status

🏗️ Scaffold complete - Ready for endpoint lifecycle implementation

## License

MIT
