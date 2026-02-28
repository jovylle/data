-- Migration: portfolio_projects — remove columns: source, external_id, raw
-- Run with: node scripts/run-sql.js sql/migrations/003_portfolio_drop_source_dedup_project_created_at.sql

drop index if exists portfolio_projects_source_idx;
alter table portfolio_projects drop column if exists source;
alter table portfolio_projects drop column if exists external_id;
alter table portfolio_projects drop column if exists raw;
