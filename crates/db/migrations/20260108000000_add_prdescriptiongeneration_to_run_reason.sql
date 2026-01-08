-- Add prdescriptiongeneration to execution_process_run_reason CHECK constraint
-- This migration recreates the execution_processes table with the updated constraint

-- Create new table with updated constraint
CREATE TABLE execution_processes_new (
    id              TEXT PRIMARY KEY NOT NULL,
    session_id      TEXT NOT NULL,
    run_reason      TEXT NOT NULL DEFAULT 'setupscript'
                       CHECK (run_reason IN ('setupscript','codingagent','devserver','cleanupscript','prdescriptiongeneration')),
    executor_action TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'running'
                       CHECK (status IN ('running','completed','failed','killed')),
    exit_code       INTEGER,
    dropped         INTEGER NOT NULL DEFAULT 0,
    started_at      DATETIME NOT NULL,
    completed_at    DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO execution_processes_new (id, session_id, run_reason, executor_action, status, exit_code, dropped, started_at, completed_at, created_at, updated_at)
SELECT id, session_id, run_reason, executor_action, status, exit_code, dropped, started_at, completed_at, created_at, updated_at
FROM execution_processes;

-- Drop old table
DROP TABLE execution_processes;

-- Rename new table
ALTER TABLE execution_processes_new RENAME TO execution_processes;

-- Recreate indexes
CREATE INDEX idx_execution_processes_session_id ON execution_processes(session_id);
CREATE INDEX idx_execution_processes_status ON execution_processes(status);
CREATE INDEX idx_execution_processes_run_reason ON execution_processes(run_reason);
CREATE INDEX idx_execution_processes_created_at ON execution_processes(created_at);

-- Recreate triggers
CREATE TRIGGER execution_processes_updated_at
AFTER UPDATE ON execution_processes
FOR EACH ROW
BEGIN
    UPDATE execution_processes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
