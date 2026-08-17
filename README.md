# ELPAC Writing Analysis Tool

Teacher-facing English Learner proficiency analysis tool grounded in official ELPAC Writing Range Performance Level Descriptors (PLDs).

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind CSS)
- **PostgreSQL** with least-privilege roles (`app_user`, `migrations_user`)
- **Clerk** for teacher authentication
- **Anthropic Claude** (`claude-sonnet-4-20250514`) for vision-based artifact analysis
- **AES-256-GCM** field-level encryption for insight text

## Privacy / FERPA

- Student labels are encrypted at rest (AES-256-GCM, per-field IV); the app never stores plaintext names
- Artifact images/PDFs are never persisted — only encrypted insight output
- All insight text columns encrypted at rest with per-field IVs
- Append-only audit log with SHA-256 hashed IPs
- TLS required for database connections

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Clerk application (publishable + secret keys)
- Anthropic API key

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env.local
   ```

   Generate an encryption key:

   ```bash
   openssl rand -hex 32
   ```

3. **Supply ELPAC PLD reference**

   Replace `data/elpac_plds.json` with the official ELPAC Writing Range PLDs. The file must match the schema in `lib/elpac/types.ts`.

4. **Run migrations** (as `migrations_user`)

   ```bash
   npm run migrate
   ```

5. **Start development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Roster workflow

1. Upload a CSV with columns: `label`, `grade_span`, `known_elpac_level` (optional)
2. Server stores UUID + grade span + level only
3. Download the returned mapping CSV (`label, student_uuid`)
4. Mapping is also saved to browser `localStorage` for display labels

## Deployment

- **Vercel**: Deploy the Next.js app. Set all env vars from `.env.example`.
- **Railway**: Host PostgreSQL. Create `app_user` and `migrations_user` roles with passwords matching your connection strings.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run migrate` | Apply database migrations |
| `npm test` | Run encryption unit tests |

## Project structure

```
app/           # Pages and API route handlers
components/    # UI components
lib/           # Server-only business logic
data/          # elpac_plds.json (static PLD reference)
db/migrations/ # SQL migration files
scripts/       # Migration runner
```

## ToDo:

- Remove ELPAC and Grade Level selectors on the analysis page
- Fix 'Manage Roster' page with buttons from other pages
- Experiment with putting observed strengths and gaps in estimated level (reduce redundancy)
- First time users' tutorial/overlay

### Big Changes
- Algorithm for new scaffolds should take into account:
-- Alot of times it's good to see the same scaffolds more than one time. Maybe a previously suggested scaffolds?
- Individual student classrooms vs. planning for a class.
- What can we track at the roster level
- What are the gaps and strengths that can be tracked over time?
- How can student tracking work for class (group gaps and subjects to track)?
