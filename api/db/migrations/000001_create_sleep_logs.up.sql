-- Migration: 000001_create_sleep_logs.up.sql
-- Creates the sleep_logs table for the Sleep Tracking module.
--
-- Design decisions:
--   - BIGSERIAL primary key: simplest correct ID strategy for this first domain table.
--   - DATE for the 'date' field: represents the calendar day the user woke up.
--   - TIME (no timezone) for bedtime/wake_time: local times; timezone support deferred.
--   - INTEGER for duration_minutes: calculated by backend (#12) and persisted here.
--   - SMALLINT for quality: domain range is 1-10; smaller type is more precise.
--   - TEXT (nullable) for notes: optional, no length restriction required.
--   - TIMESTAMPTZ for created_at/updated_at: follows docs/database.md convention.
--   - Unique constraint on date: enforces one sleep record per calendar day.
--   - CHECK on quality: enforces 1 <= quality <= 10 at the database level.
--   - CHECK on duration_minutes: enforces > 0 (equal bedtime/wake_time is invalid per #8).

CREATE TABLE sleep_logs (
    id               BIGSERIAL    PRIMARY KEY,
    date             DATE         NOT NULL,
    bedtime          TIME         NOT NULL,
    wake_time        TIME         NOT NULL,
    duration_minutes INTEGER      NOT NULL,
    quality          SMALLINT     NOT NULL,
    notes            TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT sleep_logs_date_key       UNIQUE (date),
    CONSTRAINT sleep_logs_quality_check  CHECK  (quality BETWEEN 1 AND 10),
    CONSTRAINT sleep_logs_duration_check CHECK  (duration_minutes > 0)
);
