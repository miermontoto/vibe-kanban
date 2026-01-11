use serde_json::Value;

#[derive(Debug, Clone)]
pub struct AnalyticsContext {
    pub user_id: String,
    pub analytics_service: AnalyticsService,
}

#[derive(Debug, Clone)]
pub struct AnalyticsConfig;

impl AnalyticsConfig {
    pub fn new() -> Option<Self> {
        // Analytics disabled - return None
        None
    }
}

#[derive(Clone, Debug)]
pub struct AnalyticsService;

impl AnalyticsService {
    pub fn new(_config: AnalyticsConfig) -> Self {
        Self
    }

    pub fn track_event(&self, _user_id: &str, _event_name: &str, _properties: Option<Value>) {
        // No-op: analytics disabled
    }
}

/// Stub function that returns a fixed user ID since analytics is disabled
pub fn generate_user_id() -> String {
    "local-user".to_string()
}
