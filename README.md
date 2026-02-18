# My Data Hub

Data and API provider for:
- Supabase Database
- AWS Lambda (Serverless Framework)
- Content APIs for blogs, projects, highlights, profile, notifications, and logs

## Project setup

To run this project:

1. Create a new empty GitHub repository (no README, no license, no gitignore).
1. Copy the backend env file and edit values (`cp backend/.env.example backend/.env`).
2. Install backend deps (`cd backend && npm install`) so schema/import scripts can run.
3. Run `npm run schema:apply` (with `SUPABASE_DATABASE_URL` in `.env`) to provision tables.
4. (Optional) run `npm run schema:seed` for sample records.
5. (Optional JSON migration) place your JSON export under `old_jsons/data` and run `npm run import:json` from `backend/` to load documents, blogs, notifications, projects, highlights, and function logs into Postgres tables.
6. Deploy the Lambda (`serverless deploy`) and update `frontend/app.js` with the published API endpoint before hosting the static app.

This keeps setup reproducible and makes this repo the single source of truth for your API-backed content.

## Setup reference

### 1. Supabase setup

1. Sign in at [https://app.supabase.com](https://app.supabase.com), create a new project, and choose an AWS region near your users.
2. Apply the schema defined by `backend/sql/schema.sql` (the file contains both `notes` and `projects`). Paste the contents into the SQL Editor or, after setting `SUPABASE_DATABASE_URL` in `.env`, run `npm run schema:apply` from `backend/` so the project automatically creates the tables and indexes that back this API.
3. In **Project Settings → API** copy the `API URL`.
4. Switch to **Project Settings → API Keys**, find the **“New API keys”** section, and copy the `sb_secret_…` value.
5. Copy `backend/.env.example` to `.env` and fill in:
   ```env
   SUPABASE_URL=https://xxxxxx.supabase.co
   SUPABASE_SECRET_KEY=your_sb_secret_key
   SUPABASE_DATABASE_URL=postgresql://postgres:postgres@db-host.supabase.co:5432/postgres
   ```
    Make sure `SUPABASE_DATABASE_URL` matches the Postgres connection string (Settings → Database → Connection string) so the schema helper script can connect. If the frontend ever needs direct Supabase access, enable Row Level Security and policies plus use `sb_publishable_…` on the client. Otherwise keep Supabase credentials behind Lambda.

### Schema & seeds

Everything needed to recreate the schema is stored under `backend/sql/`. Use the included Node helper at `backend/scripts/run-sql.js` (it leverages the `pg` driver) so clones can bootstrap a fresh database without manually replaying SQL.

- `npm run schema:apply` – loads `backend/sql/schema.sql` and creates the `notes` and `projects` tables plus their indexes. Make sure `SUPABASE_DATABASE_URL` (the direct Postgres connection string from the Supabase dashboard) is set in `.env` before running the command.
- `npm run schema:seed` – runs `backend/sql/seeds.sql`, which truncates both tables and inserts example notes/projects, so you can verify everything is wired up. Re-running the seed file is safe in dev environments.
- `npm run import:json` – loads `../old_jsons/data` (relative to `backend/`) into normalized tables (`content_documents`, `portfolio_projects`, `blog_posts`, `highlights`, `notification_items`, `function_logs`). The importer truncates those target tables first so the database mirrors the JSON source exactly.

Run `npm install` from `backend/` first so the dev dependency `pg` (used by the helper script) is available. The schema and seed files live inside this repository so every new clone can apply the same structure before deploying the Lambda.

### 2. Backend deploy

```sh
cd backend
npm install
npm install -g serverless # or rely on `npx serverless`
cp .env.example .env
# edit .env with SUPABASE_URL and SUPABASE_SECRET_KEY from step 1 (or `source .env`)
serverless deploy
```

This project uses Serverless Framework v3 with `serverless-offline` v12 (compatible pair). If you bump one, bump the other to a compatible major version.

Copy the API URL from the deploy output and paste it into `frontend/app.js`.

#### AWS credentials
Serverless requires AWS IAM creds. Run:

```sh
aws configure
```

Paste the Access Key ID, Secret Access Key, region (`ap-southeast-1`), and optional output format (`json`).  
Alternatively run:

```sh
serverless config credentials --provider aws --key YOUR_KEY_ID --secret YOUR_SECRET --stage dev --region ap-southeast-1
```

Set `AWS_PROFILE=deploy` (or similar) before deployments if you use a named profile.

### 3. Frontend & Production

1. Update `frontend/app.js` so `API_BASE` points to the endpoint reported by Serverless (e.g., `https://yvo2a8ln14.execute-api.ap-southeast-1.amazonaws.com`) and `API_STAGE` matches the stage (`dev`). The helper variables combine to hit `/dev/notes`.
2. Deploy the static UI:
   - **Netlify** — [Create a new site](https://app.netlify.com) (drop `frontend/` or connect your repo).  
   - **GitHub Pages** — push `frontend/` to a branch and enable GitHub Pages in Settings.  
   - **S3 + CloudFront** — upload `frontend/` to a static-hosting bucket and optionally add CloudFront for caching.
3. Optional: enable Supabase Auth + RLS policies before exposing the UI publicly.

### Production checklist

- Keep `backend/.env` out of Git (`.gitignore` already ignores `.env`/`.env.*`).  
- Rotate Supabase secrets regularly and never expose them in the browser.  
- Monitor costs with [AWS Budgets](https://console.aws.amazon.com/billing/home#/budgets) and set alerts before hitting free tier limits.  
- If you expect surges, add throttling, rate limits, or a “kill switch” Lambda to disable your stack.  
- Pin Serverless in `devDependencies` (e.g., `"serverless": "^3.34"`) and run `npx serverless deploy` so everyone uses the same CLI.
