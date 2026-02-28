-- Migration: drop projects table
-- Run with: node scripts/run-sql.js sql/migrations/001_drop_projects_table.sql

drop table if exists projects cascade;
