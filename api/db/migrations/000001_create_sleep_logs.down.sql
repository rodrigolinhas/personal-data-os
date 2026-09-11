-- Migration: 000001_create_sleep_logs.down.sql
-- Reverses 000001_create_sleep_logs.up.sql by dropping the sleep_logs table.

DROP TABLE IF EXISTS sleep_logs;
