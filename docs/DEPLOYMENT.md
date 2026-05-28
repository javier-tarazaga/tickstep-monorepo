# Deployment

How to put TickStep in front of other users: the **API** runs on Google
Cloud Run (scale-to-zero), the **database and auth** are on Supabase, and the
**desktop client** is shipped as a macOS `.dmg` with the API URL baked in.

> The Supabase Postgres + Auth are already cloud-hosted, so only the API and
> the client need deploying. (The `docker-compose.yml` Postgres is for local
> dev only.)

```
Desktop app (.dmg)  ──HTTPS──>  Cloud Run API  ──>  Supabase (Postgres + Auth)
   VITE_API_BASE_URL              europe-west3          eu-central-1
```

## Prerequisites

- `gcloud` CLI, authenticated (`gcloud auth login`) with access to the target project
- A GCP project with billing enabled
- `pnpm` and a local checkout (for building the client)
- The API secrets in `apps/api/.env` (git-ignored): `DATABASE_URL`, `DIRECT_URL`,
  `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

Set these once for the commands below:

```bash
PROJECT_ID="your-gcp-project-id"
REGION="europe-west3"   # Frankfurt — same region as the Supabase DB (eu-central-1)
gcloud config set project "$PROJECT_ID"
```

## Part 1 — Deploy the API to Cloud Run

### 1. Enable the required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 2. Store the DB connection strings as secrets

These contain the DB password, so they go in Secret Manager rather than plain
env vars. The commands read straight from `apps/api/.env` without printing the
values (and strip surrounding quotes / trailing newlines):

```bash
grep '^DATABASE_URL=' apps/api/.env | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//' | tr -d '\n\r' \
  | gcloud secrets create tickstep-database-url --data-file=-
grep '^DIRECT_URL=' apps/api/.env | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//' | tr -d '\n\r' \
  | gcloud secrets create tickstep-direct-url --data-file=-
```

> To rotate later, use `gcloud secrets versions add <name> --data-file=-` instead of `create`.

### 3. Let the Cloud Run runtime service account read the secrets

```bash
PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
for s in tickstep-database-url tickstep-direct-url; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 4. Deploy from source

Cloud Build builds the root `Dockerfile` (a monorepo-aware multi-stage build),
pushes the image to Artifact Registry, and rolls it out. The non-secret
Supabase values are passed as env vars (a custom `##` delimiter avoids issues
with special characters):

```bash
SUPA_URL="$(grep '^SUPABASE_URL=' apps/api/.env | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//' | tr -d '\n\r')"
SUPA_KEY="$(grep '^SUPABASE_PUBLISHABLE_KEY=' apps/api/.env | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//' | tr -d '\n\r')"

gcloud run deploy tickstep-api \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=3 \
  --memory=512Mi \
  --cpu-boost \
  --set-env-vars="^##^SUPABASE_URL=${SUPA_URL}##SUPABASE_PUBLISHABLE_KEY=${SUPA_KEY}" \
  --set-secrets="DATABASE_URL=tickstep-database-url:latest,DIRECT_URL=tickstep-direct-url:latest"
```

Notes:
- `--allow-unauthenticated` makes the **URL** reachable; endpoints are still
  protected by the app's own Supabase JWT auth.
- Don't set `PORT` — Cloud Run injects it and `main.ts` reads `process.env.PORT`.
- The deploy prints a **Service URL** like
  `https://tickstep-api-<project-number>.<region>.run.app`. You'll need it for
  the client build.

### 5. Verify

```bash
BASE="https://tickstep-api-XXXX.<region>.run.app"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"                 # 404 = server up
curl -s -X POST "$BASE/auth/signin" -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com","password":"wrong"}'          # 401 from Supabase = pipeline OK
```

A clean `401` (not `500`) means the container booted, connected to the DB at
startup, and reached Supabase Auth.

### Redeploys and schema changes

- **Code change:** re-run the `gcloud run deploy` command (step 4).
- **Schema change:** run migrations from your machine against the direct
  connection — do **not** migrate at container startup:
  ```bash
  pnpm --filter @tickstep/api db:deploy
  ```

## Part 2 — Build & distribute the desktop app (macOS)

Bake the deployed API URL in at build time, then package:

```bash
VITE_API_BASE_URL="https://tickstep-api-XXXX.<region>.run.app" \
  pnpm --filter @tickstep/desktop build
pnpm --filter @tickstep/desktop package
# → apps/desktop/release/Tickstep-<version>-arm64.dmg
```

- The build targets the **host architecture** (arm64 on Apple Silicon). For an
  Intel recipient, build a universal binary:
  `pnpm --filter @tickstep/desktop exec electron-builder --mac --universal`.
- The CSP in `index.html` allows `https://*.run.app`; widen it if you move to a
  custom domain.

### What to tell the recipient

The app is **not notarized** (signed only with an Apple Development cert), so
Gatekeeper blocks it on first launch. After dragging it to Applications:

- Open via **System Settings → Privacy & Security → "Open Anyway"**, or
- If macOS calls it *"damaged"*, clear the quarantine flag:
  ```bash
  xattr -dr com.apple.quarantine "/Applications/Tickstep.app"
  ```

Each user signs up in-app with their own email and gets their own tasks.

## Supabase Auth settings to check

In the Supabase dashboard → **Authentication**:

- **"Confirm email"** — if on, sign-up returns no session and the API responds
  *"check your email"*. Either turn it off, or have users click the confirmation
  link.
- Make sure **sign-ups are enabled**.

## Cost & cold starts

With `--min-instances=0` the service scales to zero and costs ~nothing while
idle; the first request after idle pays a short cold-start (mitigated by
`--cpu-boost` and keeping the API in the same region as the DB). If cold starts
ever become annoying, set `--min-instances=1` to keep one instance warm.
