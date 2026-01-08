-- Add Ralph Wiggum support to tasks table
-- Allows tasks to be executed in a loop-until-complete pattern with max iterations

-- Enable Ralph Wiggum mode (boolean flag)
ALTER TABLE tasks ADD COLUMN use_ralph_wiggum INTEGER DEFAULT 0 NOT NULL;

-- Maximum iterations before stopping (safety limit)
ALTER TABLE tasks ADD COLUMN ralph_max_iterations INTEGER DEFAULT 10;

-- Custom completion promise text (defaults to "COMPLETE" if null)
ALTER TABLE tasks ADD COLUMN ralph_completion_promise TEXT;
