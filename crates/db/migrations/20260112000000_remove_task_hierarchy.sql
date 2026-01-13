-- revertir cambios de task hierarchy (Epic/Story/Subtask)
-- eliminar task_type y parent_task_id que fueron agregados en 20260109000000

-- nota: esta migración es un placeholder para mantener la secuencia de migraciones
-- la eliminación de columnas se hará manualmente o en una migración futura
-- por ahora, solo eliminamos los indexes que puedan existir

DROP INDEX IF EXISTS idx_tasks_project_task_type;
DROP INDEX IF EXISTS idx_tasks_task_type;
DROP INDEX IF EXISTS idx_tasks_parent_task_id;
