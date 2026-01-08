-- Add auto_push_mode setting to projects table
-- This allows project-level override of the global auto-push behavior
-- NULL = use global setting, 'Never'/'Always'/'IfPrExists' = project-specific override
ALTER TABLE projects ADD COLUMN git_auto_push_mode TEXT;
