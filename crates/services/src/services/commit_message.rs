//! servicio para generación de mensajes de commit usando AI
//!
//! este módulo provee funcionalidad para generar títulos de commit
//! usando la API de Anthropic Claude
//!
//! # seguridad
//!
//! este servicio envía el contenido del diff a la API de Anthropic.
//! considera lo siguiente:
//! - el diff puede contener código fuente sensible
//! - archivos como .env, credentials, secrets podrían estar en el diff
//! - el contenido se envía usando la API key del usuario (ANTHROPIC_API_KEY)
//! - los diffs binarios son filtrados por git, pero nombres de archivo son visibles
//!
//! el servicio filtra automáticamente:
//! - archivos que matchean patrones sensibles (.env, *.pem, *credential*, etc.)
//! - diffs binarios (git los marca como "Binary files differ")

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::services::config::DEFAULT_COMMIT_TITLE_PROMPT;

/// modelo por defecto para generación de commit messages (Haiku es suficiente para esta tarea)
const DEFAULT_MODEL: &str = "claude-haiku-4-5-20251001";

/// error types para el servicio de generación de commit messages
#[derive(Debug, Error)]
pub enum CommitMessageError {
    #[error("API key not configured: ANTHROPIC_API_KEY environment variable not set")]
    ApiKeyNotConfigured,

    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("API returned error: {status} - {message}")]
    ApiError { status: u16, message: String },

    #[error("Failed to parse API response: {0}")]
    ParseError(String),

    #[error("No content in API response")]
    NoContent,

    #[error("Request timeout")]
    Timeout,
}

/// request body para la API de Anthropic Messages
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: String,
}

/// response de la API de Anthropic
#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}


/// servicio para generar mensajes de commit usando AI
/// el cliente HTTP se reutiliza para connection pooling
#[derive(Clone)]
pub struct CommitMessageService {
    client: Client,
    api_key: Option<String>,
    model: String,
}

impl CommitMessageService {
    /// crea una nueva instancia del servicio
    pub fn new() -> Self {
        let api_key = std::env::var("ANTHROPIC_API_KEY").ok();
        // permite override del modelo via environment variable
        let model = std::env::var("ANTHROPIC_COMMIT_MODEL")
            .unwrap_or_else(|_| DEFAULT_MODEL.to_string());

        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to create HTTP client"),
            api_key,
            model,
        }
    }

    /// verifica si el servicio está disponible (API key configurada)
    pub fn is_available(&self) -> bool {
        self.api_key.is_some()
    }

    /// genera un título de commit basado en el diff proporcionado
    ///
    /// # Arguments
    /// * `diff` - el diff de git (output de git diff --stat o diff completo)
    /// * `custom_prompt` - prompt personalizado opcional (se usa en lugar del default)
    /// * `agent_summary` - resumen del agente opcional para contexto adicional
    ///
    /// # Returns
    /// el título de commit generado o un error
    pub async fn generate_commit_title(
        &self,
        diff: &str,
        custom_prompt: Option<&str>,
        agent_summary: Option<&str>,
    ) -> Result<String, CommitMessageError> {
        let api_key = self
            .api_key
            .as_ref()
            .ok_or(CommitMessageError::ApiKeyNotConfigured)?;

        // construir el system prompt
        let system_prompt = custom_prompt.unwrap_or(DEFAULT_COMMIT_TITLE_PROMPT);

        // construir el user message con el diff y contexto opcional
        let mut user_content = String::new();

        if let Some(summary) = agent_summary {
            user_content.push_str("Context from the coding agent:\n");
            user_content.push_str(summary);
            user_content.push_str("\n\n");
        }

        user_content.push_str("Generate a commit title for the following changes:\n\n");

        // filtrar contenido sensible y limitar tamaño
        let sanitized_diff = sanitize_diff(diff);
        let truncated_diff = truncate_diff(&sanitized_diff, 8000);
        user_content.push_str(&truncated_diff);

        let request = AnthropicRequest {
            model: self.model.clone(),
            max_tokens: 100, // solo necesitamos un título corto
            system: system_prompt.to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: user_content,
            }],
        };

        tracing::debug!("Sending commit title generation request to Anthropic API");

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    CommitMessageError::Timeout
                } else {
                    CommitMessageError::HttpError(e)
                }
            })?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(CommitMessageError::ApiError {
                status: status.as_u16(),
                message: error_text,
            });
        }

        let response_body: AnthropicResponse = response.json().await.map_err(|e| {
            CommitMessageError::ParseError(format!("Failed to parse response: {}", e))
        })?;

        // extraer el texto de la respuesta
        let text = response_body
            .content
            .into_iter()
            .find(|block| block.content_type == "text")
            .and_then(|block| block.text)
            .ok_or(CommitMessageError::NoContent)?;

        // limpiar el título (quitar espacios, newlines, quotes)
        let title = text
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();

        if title.is_empty() {
            return Err(CommitMessageError::NoContent);
        }

        tracing::info!("Generated commit title: {}", title);
        Ok(title)
    }
}

impl Default for CommitMessageService {
    fn default() -> Self {
        Self::new()
    }
}

/// patrones de archivos sensibles que no deben enviarse a la API
const SENSITIVE_PATTERNS: &[&str] = &[
    ".env",
    ".pem",
    ".key",
    ".secret",
    "credential",
    "password",
    "token",
    "apikey",
    "api_key",
    "private",
    "id_rsa",
    "id_ed25519",
    ".p12",
    ".pfx",
    "secrets.",
    "auth.json",
    "config.json", // puede contener secrets
];

/// sanitiza el diff removiendo secciones de archivos sensibles
fn sanitize_diff(diff: &str) -> String {
    let mut result = String::with_capacity(diff.len());
    let mut skip_until_next_file = false;

    for line in diff.lines() {
        // detectar inicio de nuevo archivo en el diff
        if line.starts_with("diff --git") || line.starts_with("---") || line.starts_with("+++") {
            // extraer nombre de archivo
            let file_name = line
                .split_whitespace()
                .last()
                .unwrap_or("")
                .trim_start_matches("a/")
                .trim_start_matches("b/")
                .to_lowercase();

            // verificar si es un archivo sensible
            skip_until_next_file = SENSITIVE_PATTERNS
                .iter()
                .any(|pattern| file_name.contains(pattern));

            if skip_until_next_file && line.starts_with("diff --git") {
                result.push_str("[REDACTED: sensitive file]\n");
                continue;
            }
        }

        if skip_until_next_file {
            // saltamos el contenido de archivos sensibles
            if line.starts_with("diff --git") {
                // nuevo archivo, reevaluar
                skip_until_next_file = false;
            } else {
                continue;
            }
        }

        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(line);
    }

    result
}

/// trunca el diff a un número máximo de caracteres, preservando líneas completas
fn truncate_diff(diff: &str, max_chars: usize) -> String {
    const TRUNCATION_NOTICE: &str = "\n\n[... diff truncated for brevity ...]";

    if diff.len() <= max_chars {
        return diff.to_string();
    }

    // reservar espacio para el notice de truncation
    let available = max_chars.saturating_sub(TRUNCATION_NOTICE.len());
    let mut result = String::with_capacity(max_chars);

    for line in diff.lines() {
        // calcular cuanto espacio necesitamos para esta línea
        let need_newline = !result.is_empty();
        let line_cost = if need_newline { line.len() + 1 } else { line.len() };

        // verificar si cabe antes de añadir
        if result.len() + line_cost > available {
            break;
        }

        if need_newline {
            result.push('\n');
        }
        result.push_str(line);
    }

    result.push_str(TRUNCATION_NOTICE);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_diff_short() {
        let diff = "short diff";
        assert_eq!(truncate_diff(diff, 100), diff);
    }

    #[test]
    fn test_truncate_diff_long() {
        let diff = "line1\nline2\nline3\nline4\nline5";
        let max_chars = 80;
        let truncated = truncate_diff(diff, max_chars);
        assert!(truncated.contains("[... diff truncated"));
        // ahora el resultado respeta el límite max_chars
        assert!(
            truncated.len() <= max_chars,
            "truncated len {} exceeds max {}",
            truncated.len(),
            max_chars
        );
    }

    #[test]
    fn test_truncate_diff_exact_boundary() {
        // probar que no excede el límite incluso en casos límite
        let diff = "a\nb\nc\nd\ne\nf\ng\nh\ni\nj";
        for max in 50..100 {
            let truncated = truncate_diff(diff, max);
            assert!(
                truncated.len() <= max,
                "truncated len {} exceeds max {} for diff",
                truncated.len(),
                max
            );
        }
    }

    #[test]
    fn test_service_availability() {
        // clear any existing key for test
        let service = CommitMessageService {
            client: Client::new(),
            api_key: None,
            model: DEFAULT_MODEL.to_string(),
        };
        assert!(!service.is_available());

        let service_with_key = CommitMessageService {
            client: Client::new(),
            api_key: Some("test-key".to_string()),
            model: DEFAULT_MODEL.to_string(),
        };
        assert!(service_with_key.is_available());
    }
}
