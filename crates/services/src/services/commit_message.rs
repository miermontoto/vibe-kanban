//! servicio para generación de mensajes de commit usando AI
//!
//! este módulo provee funcionalidad para generar títulos de commit
//! usando la API de Anthropic Claude

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

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

/// prompt del sistema por defecto para generación de títulos de commit
const DEFAULT_SYSTEM_PROMPT: &str = r#"You are a commit message generator. Generate a concise git commit title based on the provided diff.

Rules:
1. Follow conventional commits format: type(scope): description
2. Types: feat, fix, docs, style, refactor, perf, test, chore, build, ci
3. Keep the title under 72 characters
4. Use imperative mood (e.g., "add" not "added")
5. Be specific but concise
6. Only output the commit title, nothing else - no quotes, no explanation

Examples:
- feat(auth): add OAuth2 login support
- fix(api): handle null response in user endpoint
- refactor(db): simplify query builder logic
- docs(readme): update installation instructions"#;

/// servicio para generar mensajes de commit usando AI
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
        let system_prompt = custom_prompt.unwrap_or(DEFAULT_SYSTEM_PROMPT);

        // construir el user message con el diff y contexto opcional
        let mut user_content = String::new();

        if let Some(summary) = agent_summary {
            user_content.push_str("Context from the coding agent:\n");
            user_content.push_str(summary);
            user_content.push_str("\n\n");
        }

        user_content.push_str("Generate a commit title for the following changes:\n\n");

        // limitar el tamaño del diff para evitar tokens excesivos
        let truncated_diff = truncate_diff(diff, 8000);
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

/// trunca el diff a un número máximo de caracteres, preservando líneas completas
fn truncate_diff(diff: &str, max_chars: usize) -> String {
    if diff.len() <= max_chars {
        return diff.to_string();
    }

    let mut result = String::with_capacity(max_chars);
    let mut chars_used = 0;
    let truncation_notice = "\n\n[... diff truncated for brevity ...]";

    let available = max_chars - truncation_notice.len();

    for line in diff.lines() {
        let line_len = line.len() + 1; // +1 for newline
        if chars_used + line_len > available {
            break;
        }
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(line);
        chars_used += line_len;
    }

    result.push_str(truncation_notice);
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
        let truncated = truncate_diff(diff, 30);
        assert!(truncated.contains("[... diff truncated"));
        assert!(truncated.len() <= 60); // some margin for the notice
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
