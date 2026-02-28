-- Migration: portfolio_projects — remove status, use single column is_published (draft vs published)
-- Run with: node scripts/run-sql.js sql/migrations/002_portfolio_projects_is_published.sql

alter table portfolio_projects drop column if exists status;

alter table portfolio_projects rename column visibility_private to is_published;

-- Flip values: visibility_private true = private (draft) -> is_published false; false = public -> true
update portfolio_projects set is_published = not is_published;
