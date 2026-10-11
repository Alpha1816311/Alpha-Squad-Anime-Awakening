# ALPHA SQUAD — Anime Awakening

An anime-inspired, privacy-conscious recruitment site and founder console for building a collaborative student team.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server on its configured workflow port
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required configuration: PostgreSQL `DATABASE_URL`, Replit-managed Clerk keys, and server-side `FOUNDER_USER_IDS` (comma-separated Clerk user IDs) to authorize founder accounts.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/alpha-squad` — public site, application, privacy request flow, and private founder UI
- `artifacts/api-server` — application, privacy, and founder API routes
- `lib/api-spec/openapi.yaml` — API contract source of truth; regenerate clients with `pnpm --filter @workspace/api-spec run codegen`
- `lib/db/src/schema` — PostgreSQL/Drizzle schema
- `artifacts/alpha-squad/src/alpha.css` — visual system and responsive styling

## Architecture decisions

- Founder access is an explicit server-side Clerk user ID allowlist. Do not bypass it or trust client-side role checks.
- Integrations must report their real configured state. Do not simulate email delivery or AI analysis.
- Applicant deletion permanently removes the matching application and founder notes; withdrawal retains a withdrawn record for recruitment history.

## Product

- Candidates can explore team roles and submit a multi-step application; applications are stored in PostgreSQL and reviewed in the founder console.
- Candidates can withdraw or permanently delete an application using its receipt reference and the matching email address.
- Recruitment is open to any college, course, year, gender, and skill background. Anime knowledge is not required; favorite-anime and fictional-class answers are optional and never affect eligibility.

## Gotchas

- Set `FOUNDER_USER_IDS` on the API server before founder access will work; an unset list intentionally denies founder access.
- Email notifications and AI analysis remain disabled until real providers are configured; the public status endpoint exposes this state.
- After editing the OpenAPI contract, regenerate API clients before typechecking. Push schema changes only to the development database.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
