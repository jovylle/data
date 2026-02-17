# Supabase + AWS Lambda Template

Simple starter template for:
- Supabase Database
- AWS Lambda (Serverless Framework)
- Static HTML frontend

## Setup

### 1. Supabase setup

1. Sign in at [https://app.supabase.com](https://app.supabase.com), create a new project, and choose an AWS region near your users.
2. Open the **SQL Editor** and run:
   ```sql
   create table notes (
     id uuid primary key default gen_random_uuid(),
     title text,
     content text,
     created_at timestamp default now()
   );
   ```
3. In **Project Settings → API** copy the `API URL`.
4. Switch to **Project Settings → API Keys**, find the **“New API keys”** section, and copy the `sb_secret_…` value.
5. Copy `backend/.env.example` to `.env` and fill in:
   ```env
   SUPABASE_URL=https://xxxxxx.supabase.co
   SUPABASE_SECRET_KEY=your_sb_secret_key
   ```
   If the frontend ever needs direct Supabase access, enable Row Level Security and policies plus use `sb_publishable_…` on the client. Otherwise keep Supabase credentials behind Lambda.

### 2. Backend deploy

```sh
cd backend
npm install
npm install -g serverless # or rely on `npx serverless`
cp .env.example .env
# edit .env with SUPABASE_URL and SUPABASE_SECRET_KEY from step 1 (or `source .env`)
serverless deploy
```

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

1. Update `frontend/app.js` so `API_URL` points at your API Gateway endpoint from Serverless.
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
