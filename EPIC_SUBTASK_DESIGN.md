# EPIC and Sub-Task Feature Design

## Overview
implementar jerarquía de tareas tipo Jira: EPIC → STORY → SUBTASK con soporte para swimlanes y filtrado

## Schema Changes

### 1. Add task_type enum and parent_task_id to tasks table

```sql
-- nueva migración: 20260109000000_add_task_hierarchy.sql

ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'story'
    CHECK (task_type IN ('epic', 'story', 'subtask'));

ALTER TABLE tasks ADD COLUMN parent_task_id BLOB
    REFERENCES tasks(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);
```

### 2. Task Type Rules

| Type | Can have parent? | Can be parent? | Can execute? | Display |
|------|-----------------|----------------|--------------|---------|
| EPIC | No | Yes (STORY, SUBTASK) | No | Swimlane header |
| STORY | Yes (EPIC) | Yes (SUBTASK) | Yes | Card in column |
| SUBTASK | Yes (STORY or EPIC) | No | Yes | Nested under parent card |

### 3. Dual Hierarchy Model

**Logical Hierarchy** (task organization):
- `parent_task_id`: EPIC → STORY → SUBTASK
- usado para display, filtering, swimlanes

**Execution Hierarchy** (workspace spawning):
- `parent_workspace_id`: cualquier task ejecutable puede crear child tasks en workspace
- mantener comportamiento actual para tareas spawneadas por agent

### 4. Data Model Changes

#### Rust Structs (crates/db/src/models/task.rs)

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[ts(export)]
pub enum TaskType {
    Epic,
    Story,
    Subtask,
}

pub struct Task {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub task_type: TaskType,           // nuevo
    pub parent_task_id: Option<Uuid>,  // nuevo
    pub parent_workspace_id: Option<Uuid>,
    pub shared_task_id: Option<Uuid>,
    pub use_ralph_wiggum: bool,
    pub ralph_max_iterations: Option<i64>,
    pub ralph_completion_promise: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// nuevo struct para hierarchía completa
pub struct TaskHierarchy {
    pub task: Task,
    pub parent: Option<Box<Task>>,
    pub children: Vec<Task>,
    pub subtasks: Vec<Task>,  // filtrado por task_type = subtask
}
```

#### TypeScript Types (shared/types.ts)

```typescript
export type TaskType = "epic" | "story" | "subtask";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  task_type: TaskType;        // nuevo
  parent_task_id: string | null;  // nuevo
  parent_workspace_id: string | null;
  shared_task_id: string | null;
  use_ralph_wiggum: boolean;
  ralph_max_iterations: bigint | null;
  ralph_completion_promise: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskHierarchy = {
  task: Task;
  parent: Task | null;
  children: Array<Task>;
  subtasks: Array<Task>;
};
```

### 5. Database Queries

#### Get tasks with hierarchy for project

```rust
// retornar tasks agrupadas por epic
pub async fn find_by_project_id_with_hierarchy(
    pool: &SqlitePool,
    project_id: Uuid,
) -> Result<Vec<TaskHierarchy>> {
    // query complejo con joins para traer parent + children
    let tasks = sqlx::query_as::<_, Task>(
        r#"
        SELECT t.*
        FROM tasks t
        WHERE t.project_id = ?
        ORDER BY
            CASE WHEN t.task_type = 'epic' THEN 0
                 WHEN t.task_type = 'story' THEN 1
                 ELSE 2 END,
            t.created_at
        "#
    )
    .bind(project_id.as_bytes())
    .fetch_all(pool)
    .await?;

    // construir hierarchía en memoria
    // ...
}
```

#### Validation rules

```rust
pub async fn validate_parent_task_id(
    pool: &SqlitePool,
    task_type: TaskType,
    parent_task_id: Option<Uuid>,
) -> Result<()> {
    match (task_type, parent_task_id) {
        (TaskType::Epic, Some(_)) => {
            Err(anyhow!("EPICs cannot have parent tasks"))
        }
        (TaskType::Subtask, None) => {
            Err(anyhow!("SUBTASKs must have a parent task"))
        }
        (_, Some(parent_id)) => {
            // verificar que parent existe y tipo es válido
            let parent = Task::find_by_id(pool, parent_id).await?;
            match (task_type, parent.task_type) {
                (TaskType::Story, TaskType::Epic) => Ok(()),
                (TaskType::Subtask, TaskType::Story | TaskType::Epic) => Ok(()),
                _ => Err(anyhow!("Invalid parent-child task type combination"))
            }
        }
        _ => Ok(())
    }
}
```

## API Endpoints

### New/Modified Endpoints

```
GET  /api/projects/{id}/tasks/hierarchy
  -> retornar TaskHierarchy[] con EPICs, STORYs, SUBTASKs anidados

POST /api/tasks
  body: { task_type, parent_task_id, ... }
  -> validar parent_task_id según reglas

PUT  /api/tasks/{id}/convert-to-epic
  -> convertir STORY → EPIC (solo si no tiene parent)

PUT  /api/tasks/{id}/move-to-parent
  body: { new_parent_id }
  -> reasignar parent_task_id con validación
```

## Frontend Changes

### 1. Kanban Board View Modes

**Mode 1: Flat View (default)**
- mostrar solo STORYs y EPICs sin parent
- SUBTASKs collapsed bajo parent card
- filter dropdown: All | EPICs only | Stories only

**Mode 2: Swimlane View (nuevo)**
- cada EPIC = horizontal swimlane
- lanes contienen columns (todo, inprogress, done, etc)
- STORYs y SUBTASKs del epic en sus respectivas columns dentro del lane
- lane sin epic = "No Epic" para orphan tasks

### 2. Task Card Updates

```tsx
// frontend/src/components/TaskCard.tsx
interface TaskCardProps {
  task: Task;
  hierarchy?: TaskHierarchy;
  showSubtasks?: boolean;
}

// visual indicators
- EPIC: borde grueso purple, icon épica
- STORY: borde normal, icon default
- SUBTASK: borde delgado, indentado, icon checkbox
```

### 3. Create Task Dialog

```tsx
// frontend/src/components/dialogs/CreateTaskDialog.tsx
- agregar selector de task_type: EPIC | STORY | SUBTASK
- si STORY o SUBTASK: agregar parent selector (dropdown con EPICs/STORYs)
- validar según reglas
- disable epic selection si parent ya tiene uno
```

### 4. Epic Management

```tsx
// frontend/src/components/dialogs/EpicManagementDialog.tsx (nuevo)
- listar tasks del epic
- mover tasks entre epics (drag & drop)
- convertir story → epic
- agregar/quitar tasks del epic
```

### 5. Filters & Swimlanes

```tsx
// frontend/src/components/KanbanBoard.tsx
const [viewMode, setViewMode] = useState<'flat' | 'swimlane'>('flat');
const [epicFilter, setEpicFilter] = useState<string | null>(null);

// swimlane rendering
{viewMode === 'swimlane' && (
  <div className="swimlanes">
    {epics.map(epic => (
      <EpicSwimlane key={epic.id} epic={epic}>
        {columns.map(col => (
          <Column status={col} tasks={getTasksForEpicAndStatus(epic, col)} />
        ))}
      </EpicSwimlane>
    ))}
    <EpicSwimlane epic={null}> {/* No Epic lane */}
      {/* orphan tasks */}
    </EpicSwimlane>
  </div>
)}
```

## Migration Strategy

### Phase 1: Schema Migration
1. crear migración con task_type y parent_task_id
2. default task_type = 'story' para todas las tasks existentes
3. ejecutar `pnpm run prepare-db`

### Phase 2: Backend Updates
1. actualizar Task model en Rust
2. agregar validation functions
3. modificar endpoints existentes (create, update)
4. agregar nuevo endpoint hierarchy

### Phase 3: Type Generation
1. regenerar TypeScript types: `pnpm run generate-types`
2. verificar que shared/types.ts tiene TaskType enum

### Phase 4: Frontend Updates
1. actualizar TaskCard component
2. agregar task type selector en CreateTaskDialog
3. implementar swimlane view
4. agregar epic filters

### Phase 5: Testing
1. unit tests para validation rules
2. integration tests para hierarchy queries
3. manual testing de UI con EPICs y SUBTASKs

## Edge Cases & Considerations

1. **EPIC Execution**: EPICs no ejecutan, solo organizan
   - disable "Run" button para task_type=epic
   - mostrar warning si intenta crear workspace de epic

2. **Parent Deletion**: ON DELETE CASCADE
   - si EPIC se borra → sus STORYs quedan huérfanas (parent_task_id = null)
   - alternativa: prevent deletion si tiene children

3. **Circular Dependencies**:
   - validar que parent_task_id no crea ciclo
   - query recursivo para detectar loops

4. **Workspace Spawning vs Logical Hierarchy**:
   - STORY puede spawnearse desde workspace Y tener parent EPIC
   - ambos parent_workspace_id y parent_task_id pueden coexistir
   - UI debe mostrar ambas relaciones claramente

5. **Status Propagation**:
   - EPIC status = computed from children
   - "done" solo si todos los children done
   - "inprogress" si al menos uno inprogress

6. **Default Behavior**:
   - crear task sin especificar tipo → STORY
   - crear desde workspace (spawned) → STORY + parent_workspace_id
   - usuario puede cambiar a SUBTASK y asignar parent_task_id después

## Files to Modify

### Backend
- `crates/db/migrations/20260109000000_add_task_hierarchy.sql` (new)
- `crates/db/src/models/task.rs` (+200 lines)
- `crates/server/src/routes/tasks.rs` (+150 lines)
- `crates/server/src/bin/generate_types.rs` (verificar TS exports)

### Frontend
- `shared/types.ts` (auto-generated)
- `frontend/src/components/TaskCard.tsx` (+100 lines)
- `frontend/src/components/dialogs/CreateTaskDialog.tsx` (+80 lines)
- `frontend/src/components/KanbanBoard.tsx` (+200 lines for swimlanes)
- `frontend/src/components/EpicSwimlane.tsx` (new, ~150 lines)
- `frontend/src/components/dialogs/EpicManagementDialog.tsx` (new, ~200 lines)
- `frontend/src/hooks/useTaskHierarchy.ts` (new, ~50 lines)

## Next Steps
1. ✅ Review este diseño con usuario
2. Crear migración SQL
3. Implementar backend changes
4. Generar types
5. Implementar frontend changes
6. Testing completo
