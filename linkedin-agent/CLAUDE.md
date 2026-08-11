# LinkedIn Agent

Autonomous LinkedIn content agent for **Go3net Technologies Ltd**. It drafts, schedules, publishes, and measures LinkedIn posts for two brands:

- **Go3net** — the technology company (IT services, software, the Go3net Office platform)
- **SpeedFi** — the internet/connectivity brand

Each brand has its own voice, audience, content pillars, and posting cadence, defined in code under `src/brands/`. The database (Prisma + PostgreSQL) is the source of truth for what has been drafted, approved, scheduled, and published.

## Layout

```
.
├── CLAUDE.md               # You are here
├── prisma/
│   └── schema.prisma       # Brands, posts, engagement snapshots, agent runs
└── src/
    └── brands/
        ├── types.ts        # BrandConfig contract
        ├── go3net.ts       # Go3net brand voice + cadence
        ├── speedfi.ts      # SpeedFi brand voice + cadence
        └── index.ts        # Brand registry
```

## Commands

```bash
npm install                 # install dependencies
npx prisma migrate dev      # create/apply migrations (needs DATABASE_URL)
npx prisma generate         # regenerate the Prisma client
npm run typecheck           # tsc --noEmit
```

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Content generation (Claude API) |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn Marketing API token |
| `LINKEDIN_ORG_ID_GO3NET` | LinkedIn organization URN id for the Go3net page |
| `LINKEDIN_ORG_ID_SPEEDFI` | LinkedIn organization URN id for the SpeedFi page |
| `TIMEZONE` | Scheduling timezone (default `Africa/Lagos`) |

Never hardcode tokens or organization ids — they always come from the environment.

## How the agent works (pipeline)

1. **Ideate** — generate `ContentIdea` rows per brand from its content pillars, respecting pillar weights.
2. **Draft** — turn approved ideas into `Post` drafts using the brand's voice rules. A draft must pass the brand's `neverSay` list and stay within LinkedIn's 3,000-character limit.
3. **Schedule** — assign drafts to the brand's posting slots (`postingSchedule` in the brand config). Never schedule two posts for the same brand on the same day.
4. **Publish** — push due posts to the LinkedIn API; store the returned post URN on the `Post` row and mark it `PUBLISHED` (or `FAILED` with the error).
5. **Measure** — capture `EngagementSnapshot` rows (impressions, reactions, comments, shares, clicks) at 24h, 72h, and 7d after publishing.

Every end-to-end invocation is recorded as an `AgentRun` for observability.

## Conventions

- TypeScript, strict mode, ESM (`"type": "module"`).
- Brand behavior lives in `src/brands/*.ts` — never inline brand copy, hashtags, or cadence anywhere else. Adding a brand = one new file conforming to `BrandConfig` + one registry entry in `src/brands/index.ts` + one `Brand` row (seeded by slug).
- Post content is written for LinkedIn: hook in the first two lines (before the "…see more" fold), short paragraphs, 3–5 hashtags at the end, one clear CTA.
- All scheduling math happens in the brand's timezone (`Africa/Lagos`), stored in UTC.
- Drafts are never auto-published: a post must be moved to `APPROVED` (by a human or an explicit approval step) before the scheduler will pick it up.
