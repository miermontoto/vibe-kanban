use std::{env, path::PathBuf};

use tokio::fs;

pub async fn write_port_file(port: u16) -> std::io::Result<PathBuf> {
    // allow override for worktree-specific port files
    let path = if let Ok(custom_path) = env::var("VK_PORT_FILE") {
        PathBuf::from(custom_path)
    } else {
        // default: global temp directory
        env::temp_dir().join("vibe-kanban").join("vibe-kanban.port")
    };

    tracing::debug!("Writing port {} to {:?}", port, path);

    // create parent directory if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    fs::write(&path, port.to_string()).await?;
    Ok(path)
}

pub async fn read_port_file(app_name: &str) -> std::io::Result<u16> {
    let dir = env::temp_dir().join(app_name);
    let path = dir.join(format!("{app_name}.port"));
    tracing::debug!("Reading port from {:?}", path);

    let content = fs::read_to_string(&path).await?;
    let port: u16 = content
        .trim()
        .parse()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

    Ok(port)
}
