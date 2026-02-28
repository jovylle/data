-- Migration: portfolio_projects — add github_raw (fork, id, html_url, created_at, updated_at, pushed_at from GitHub API)
-- Run with: node scripts/run-sql.js sql/migrations/004_portfolio_github_raw.sql

alter table portfolio_projects drop column if exists project_created_at;
alter table portfolio_projects add column if not exists github_raw jsonb;
