use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TaskLabel {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub color: String, // hex color code
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct CreateTaskLabel {
    pub project_id: Uuid,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct UpdateTaskLabel {
    pub name: Option<String>,
    pub color: Option<String>,
}

impl TaskLabel {
    /// obtener todas las etiquetas de un proyecto
    pub async fn find_by_project_id(
        pool: &SqlitePool,
        project_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            TaskLabel,
            r#"SELECT id as "id!: Uuid", project_id as "project_id!: Uuid", name, color,
                      created_at as "created_at!: DateTime<Utc>", updated_at as "updated_at!: DateTime<Utc>"
               FROM task_labels
               WHERE project_id = $1
               ORDER BY name ASC"#,
            project_id
        )
        .fetch_all(pool)
        .await
    }

    /// obtener etiqueta por id
    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as!(
            TaskLabel,
            r#"SELECT id as "id!: Uuid", project_id as "project_id!: Uuid", name, color,
                      created_at as "created_at!: DateTime<Utc>", updated_at as "updated_at!: DateTime<Utc>"
               FROM task_labels
               WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await
    }

    /// crear nueva etiqueta
    pub async fn create(pool: &SqlitePool, data: &CreateTaskLabel) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4();
        sqlx::query_as!(
            TaskLabel,
            r#"INSERT INTO task_labels (id, project_id, name, color)
               VALUES ($1, $2, $3, $4)
               RETURNING id as "id!: Uuid", project_id as "project_id!: Uuid", name, color,
                         created_at as "created_at!: DateTime<Utc>", updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            data.project_id,
            data.name,
            data.color
        )
        .fetch_one(pool)
        .await
    }

    /// actualizar etiqueta existente
    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        data: &UpdateTaskLabel,
    ) -> Result<Self, sqlx::Error> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let name = data.name.as_ref().unwrap_or(&existing.name);
        let color = data.color.as_ref().unwrap_or(&existing.color);

        sqlx::query_as!(
            TaskLabel,
            r#"UPDATE task_labels
               SET name = $2, color = $3, updated_at = datetime('now', 'subsec')
               WHERE id = $1
               RETURNING id as "id!: Uuid", project_id as "project_id!: Uuid", name, color,
                         created_at as "created_at!: DateTime<Utc>", updated_at as "updated_at!: DateTime<Utc>""#,
            id,
            name,
            color
        )
        .fetch_one(pool)
        .await
    }

    /// eliminar etiqueta (también elimina asociaciones automáticamente por CASCADE)
    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!("DELETE FROM task_labels WHERE id = $1", id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// obtener etiquetas asociadas a una tarea específica
    pub async fn find_by_task_id(
        pool: &SqlitePool,
        task_id: Uuid,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as!(
            TaskLabel,
            r#"SELECT tl.id as "id!: Uuid", tl.project_id as "project_id!: Uuid", tl.name, tl.color,
                      tl.created_at as "created_at!: DateTime<Utc>", tl.updated_at as "updated_at!: DateTime<Utc>"
               FROM task_labels tl
               INNER JOIN task_label_associations tla ON tla.label_id = tl.id
               WHERE tla.task_id = $1
               ORDER BY tl.name ASC"#,
            task_id
        )
        .fetch_all(pool)
        .await
    }

    /// asociar etiqueta con tarea
    pub async fn associate_with_task(
        pool: &SqlitePool,
        task_id: Uuid,
        label_id: Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "INSERT OR IGNORE INTO task_label_associations (task_id, label_id) VALUES ($1, $2)",
            task_id,
            label_id
        )
        .execute(pool)
        .await?;
        Ok(())
    }

    /// desasociar etiqueta de tarea
    pub async fn disassociate_from_task(
        pool: &SqlitePool,
        task_id: Uuid,
        label_id: Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "DELETE FROM task_label_associations WHERE task_id = $1 AND label_id = $2",
            task_id,
            label_id
        )
        .execute(pool)
        .await?;
        Ok(())
    }

    /// reemplazar todas las etiquetas de una tarea (útil para actualizaciones)
    pub async fn sync_task_labels(
        pool: &SqlitePool,
        task_id: Uuid,
        label_ids: &[Uuid],
    ) -> Result<(), sqlx::Error> {
        // eliminar asociaciones existentes
        sqlx::query!("DELETE FROM task_label_associations WHERE task_id = $1", task_id)
            .execute(pool)
            .await?;

        // agregar nuevas asociaciones
        for label_id in label_ids {
            Self::associate_with_task(pool, task_id, *label_id).await?;
        }

        Ok(())
    }
}
