# LinkedIn Agent

Generates, routes for human approval, and publishes LinkedIn content for two
company Pages owned by Go3net Technologies Limited.

## What this is

A standalone service. It writes draft posts with the Anthropic API, sends each
draft to the owner over WhatsApp for approval, and publishes approved posts to
LinkedIn on a schedule. It then pulls engagement back so the generator can learn
which content pillars perform.

Two brands, one codebase:

- **Go3net Technologies** — ICT consultancy and software engineering
- **SPEEDFI** — WhatsApp-first commerce platform for African small businesses

## Decisions already made — do not relitigate these

- **Standalone service.** Not inside the SPEEDFI codebase. Own repo, own
  database, own deployment. SPEEDFI is live production; marketing tooling does
  not share its deploy pipeline.
- **Not n8n.** This needs OAuth refresh on a 60-day clock, a real state machine,
  and content-history queries. Those belong in code and Postgres.
- **Human approval on every post at launch.** Nothing publishes unattended.
  This is a hard requirement, not a phase-one compromise. Do not add an
  auto-publish path without being asked.
- **Brand voice lives in TypeScript**, not the database, so tuning history is in
  git.

## Stack

Next.js (App Router) + TypeScript, Prisma + PostgreSQL, deployed on Railway.
Anthropic API for generation. Meta WhatsApp Cloud API for approvals. Cloudinary
for images. This matches the stack used across the owner's other projects — do
not substitute alternatives.

## Layout

```
prisma/schema.prisma      Provided. Start from it; extend rather than redesign.
src/brands/
  types.ts                BrandConfig interface — derive from the two configs
  go3net.ts               Provided
  speedfi.ts              Provided
  index.ts                registry keyed by slug
src/lib/
  anthropic.ts            generation client
  linkedin.ts             OAuth, token refresh, publish, image upload, metrics
  whatsapp.ts             Cloud API send + inbound webhook parsing
  crypto.ts               encrypt/decrypt for token columns
src/jobs/
  generate.ts             daily: pick pillar, write drafts
  approve.ts              inbound WhatsApp replies -> state transitions
  publish.ts              due APPROVED/SCHEDULED posts -> LinkedIn
  refreshTokens.ts        weekly
  syncMetrics.ts          engagement backfill for published posts
app/api/
  auth/linkedin/          OAuth start + callback
  webhooks/whatsapp/      Cloud API webhook (verify token + signature check)
  cron/[job]/             invoked by Railway cron, guarded by CRON_SECRET
```

## Build order

1. Prisma schema + migration + seed from the brand configs
2. `src/brands/types.ts` inferred from the two provided config files
3. Crypto helper and env validation
4. LinkedIn OAuth flow and token storage (works before API approval lands —
   the app exists in dev tier, only publishing scope is gated)
5. Generator with pillar rotation and last-30-posts de-duplication
6. WhatsApp approval loop
7. Publisher
8. Metrics sync

Steps 1-3 and 5-6 do not depend on LinkedIn approval. Build those first.

## Generation rules

The generator must:

- Pick a pillar weighted by `Pillar.weight`, then penalise any pillar used in
  the last 5 posts for that brand so nothing dominates a week.
- Load the last 30 post bodies for that brand and instruct the model to avoid
  repeating their hooks, structures and subjects.
- Apply the brand's `guardrails.banned` list and `guardrails.rules` verbatim in
  the prompt, then reject and regenerate (max 2 attempts) if a banned phrase
  survives.
- Refuse to invent client names, customer stories, metrics, testimonials or
  certifications. If a pillar requires a real story and no topic seed supplies
  one, skip that pillar and pick another. This is a correctness requirement —
  a fabricated client story published to a company Page is the worst failure
  this system can produce.
- Rotate CTAs, honouring `format.cta.omitOnPillars`.

## Approval protocol

Draft goes out over WhatsApp with the brand, the pillar, and the full body.
Replies:

- `1` or `ok` → APPROVED
- `edit: <instruction>` → CHANGES_REQUESTED, regenerate with the note as
  additional context, increment `revisionRound`, send back
- `no` or `skip` → DISCARDED
- No reply within 12 hours → TIMED_OUT, post is not published, owner notified

Every inbound message writes an `ApprovalEvent`. That table is append-only.

## Non-negotiables

- **Never publish twice.** `Post.linkedinPostUrn` is unique. Set status to
  PUBLISHING before the API call and treat a unique-constraint failure on
  retry as success, not error.
- **Never log a token,** in any environment, including error handlers. Access
  and refresh tokens are encrypted at rest with `TOKEN_ENCRYPTION_KEY`.
- **Verify the WhatsApp webhook signature** on every inbound request. An
  unsigned request must not be able to approve a post.
- **Cron routes require `CRON_SECRET`.** They must not be publicly invokable.
- Use the `LinkedIn-Version` header on every LinkedIn call and the `/rest/posts`
  endpoint. The older `/v2/ugcPosts` endpoint is deprecated.

## LinkedIn API status

Community Management API access was requested on 11 Aug 2026 under
"Go3net Technologies Limited", for Page management and Page analytics only.
Approval is pending. Until it lands, the publisher should be behind a
`LINKEDIN_PUBLISH_ENABLED` flag that logs the intended call instead of making
it, so the whole pipeline can be exercised end to end.

Images use register-then-reference: upload to LinkedIn, get an image URN, then
attach the URN to the post. A direct image URL will not work.

## Environment

```
DATABASE_URL
ANTHROPIC_API_KEY
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_REDIRECT_URI
LINKEDIN_PUBLISH_ENABLED       false until API approval
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET            for webhook signature verification
APPROVER_NUMBERS               comma-separated, allowlist for approvals
TOKEN_ENCRYPTION_KEY           32-byte key, base64
CRON_SECRET
CLOUDINARY_URL
```

Validate all of these at boot with zod and fail loudly. A missing WhatsApp
token should not surface as a silent no-op at 8:30am.

## Working style

The owner runs the company and directs the work; he is comfortable running
commands and reading code but is not a full-time engineer. Explain what a
change does and why before making it. Prefer boring, readable code over clever
abstractions. Ask before adding a dependency.
