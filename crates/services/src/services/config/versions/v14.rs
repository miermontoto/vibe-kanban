use anyhow::Error;
use executors::{executors::BaseCodingAgent, profile::ExecutorProfileId};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
pub use v13::{
    EditorConfig, EditorType, GitCommitTitleMode, GitHubConfig, NotificationConfig, ShowcaseState,
    SoundFile, ThemeMode, UiLanguage, DEFAULT_COMMIT_TITLE_PROMPT,
};

use crate::services::config::versions::v13;

fn default_git_branch_prefix() -> String {
    "vk".to_string()
}

fn default_pr_auto_description_enabled() -> bool {
    true
}

fn default_git_auto_commit_enabled() -> bool {
    true
}

fn default_font_family() -> Option<String> {
    None
}

fn default_use_google_fonts() -> bool {
    true
}

fn default_use_nerd_fonts() -> bool {
    true
}

fn default_discord_counter_enabled() -> bool {
    true
}

fn default_git_commit_title_mode() -> GitCommitTitleMode {
    GitCommitTitleMode::default()
}

fn default_auto_pr_on_review_enabled() -> bool {
    false
}

fn default_auto_pr_draft() -> bool {
    true
}

fn default_redirect_to_attempt_on_create() -> bool {
    false
}

fn default_git_auto_push_mode() -> GitAutoPushMode {
    GitAutoPushMode::default()
}

/// modo de auto-push después de commits
#[derive(Clone, Debug, Serialize, Deserialize, TS, Default, PartialEq)]
pub enum GitAutoPushMode {
    /// nunca hace push automático (comportamiento por defecto)
    #[default]
    Never,
    /// siempre hace push después de commit
    Always,
    /// hace push solo si ya existe un PR para la rama actual
    IfPrExists,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct Config {
    pub config_version: String,
    pub theme: ThemeMode,
    pub executor_profile: ExecutorProfileId,
    pub disclaimer_acknowledged: bool,
    pub onboarding_acknowledged: bool,
    pub notifications: NotificationConfig,
    pub editor: EditorConfig,
    pub github: GitHubConfig,
    pub workspace_dir: Option<String>,
    #[serde(default)]
    pub language: UiLanguage,
    #[serde(default = "default_git_branch_prefix")]
    pub git_branch_prefix: String,
    #[serde(default)]
    pub showcases: ShowcaseState,
    #[serde(default = "default_pr_auto_description_enabled")]
    pub pr_auto_description_enabled: bool,
    #[serde(default)]
    pub pr_auto_description_prompt: Option<String>,
    /// cuando está habilitado, el agente hará commit automático después de cambios exitosos
    #[serde(default = "default_git_auto_commit_enabled")]
    pub git_auto_commit_enabled: bool,
    /// custom font family override (system fonts will be used if None)
    #[serde(default = "default_font_family")]
    pub font_family: Option<String>,
    /// cuando está habilitado, se cargarán las fuentes de Google (Chivo Mono, Inter, JetBrains Mono)
    #[serde(default = "default_use_google_fonts")]
    pub use_google_fonts: bool,
    /// cuando está habilitado, se cargarán los símbolos de Nerd Fonts para iconos en la interfaz
    #[serde(default = "default_use_nerd_fonts")]
    pub use_nerd_fonts: bool,
    /// cuando está habilitado, se muestra el contador de usuarios online de Discord en la barra de navegación
    #[serde(default = "default_discord_counter_enabled")]
    pub discord_counter_enabled: bool,
    /// modo de generación del título de commit para auto-commits
    #[serde(default = "default_git_commit_title_mode")]
    pub git_commit_title_mode: GitCommitTitleMode,
    /// prompt personalizado para generación de títulos de commit (modo AiGenerated)
    #[serde(default)]
    pub git_commit_title_prompt: Option<String>,
    /// cuando está habilitado, se crea automáticamente un PR cuando la tarea pasa a "In Review"
    #[serde(default = "default_auto_pr_on_review_enabled")]
    pub auto_pr_on_review_enabled: bool,
    /// cuando está habilitado, los PRs automáticos se crean como draft
    #[serde(default = "default_auto_pr_draft")]
    pub auto_pr_draft: bool,
    /// cuando está habilitado, redirige automáticamente al intento después de crear una tarea
    #[serde(default = "default_redirect_to_attempt_on_create")]
    pub redirect_to_attempt_on_create: bool,
    /// modo de auto-push después de commits exitosos
    #[serde(default = "default_git_auto_push_mode")]
    pub git_auto_push_mode: GitAutoPushMode,
}

impl Config {
    fn from_v13_config(old_config: v13::Config) -> Self {
        Self {
            config_version: "v14".to_string(),
            theme: old_config.theme,
            executor_profile: old_config.executor_profile,
            disclaimer_acknowledged: old_config.disclaimer_acknowledged,
            onboarding_acknowledged: old_config.onboarding_acknowledged,
            notifications: old_config.notifications,
            editor: old_config.editor,
            github: old_config.github,
            workspace_dir: old_config.workspace_dir,
            language: old_config.language,
            git_branch_prefix: old_config.git_branch_prefix,
            showcases: old_config.showcases,
            pr_auto_description_enabled: old_config.pr_auto_description_enabled,
            pr_auto_description_prompt: old_config.pr_auto_description_prompt,
            git_auto_commit_enabled: old_config.git_auto_commit_enabled,
            font_family: old_config.font_family,
            use_google_fonts: old_config.use_google_fonts,
            use_nerd_fonts: old_config.use_nerd_fonts,
            discord_counter_enabled: old_config.discord_counter_enabled,
            git_commit_title_mode: old_config.git_commit_title_mode,
            git_commit_title_prompt: old_config.git_commit_title_prompt,
            auto_pr_on_review_enabled: old_config.auto_pr_on_review_enabled,
            auto_pr_draft: old_config.auto_pr_draft,
            redirect_to_attempt_on_create: old_config.redirect_to_attempt_on_create,
            // nuevo campo con valor por defecto
            git_auto_push_mode: default_git_auto_push_mode(),
        }
    }

    pub fn from_previous_version(raw_config: &str) -> Result<Self, Error> {
        let old_config = v13::Config::from(raw_config.to_string());
        Ok(Self::from_v13_config(old_config))
    }
}

impl From<String> for Config {
    fn from(raw_config: String) -> Self {
        if let Ok(config) = serde_json::from_str::<Config>(&raw_config)
            && config.config_version == "v14"
        {
            return config;
        }

        match Self::from_previous_version(&raw_config) {
            Ok(config) => {
                tracing::info!("Config upgraded to v14");
                config
            }
            Err(e) => {
                tracing::warn!("Config migration failed: {}, using default", e);
                Self::default()
            }
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            config_version: "v14".to_string(),
            theme: ThemeMode::System,
            executor_profile: ExecutorProfileId::new(BaseCodingAgent::ClaudeCode),
            disclaimer_acknowledged: false,
            onboarding_acknowledged: false,
            notifications: NotificationConfig::default(),
            editor: EditorConfig::default(),
            github: GitHubConfig::default(),
            workspace_dir: None,
            language: UiLanguage::default(),
            git_branch_prefix: default_git_branch_prefix(),
            showcases: ShowcaseState::default(),
            pr_auto_description_enabled: true,
            pr_auto_description_prompt: None,
            git_auto_commit_enabled: true,
            font_family: None,
            use_google_fonts: true,
            use_nerd_fonts: true,
            discord_counter_enabled: true,
            git_commit_title_mode: GitCommitTitleMode::default(),
            git_commit_title_prompt: None,
            auto_pr_on_review_enabled: false,
            auto_pr_draft: true,
            redirect_to_attempt_on_create: false,
            git_auto_push_mode: GitAutoPushMode::default(),
        }
    }
}
