<h1 align="center">vkm</h1>

<p align="center">Task management and orchestration for AI coding agents</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@miermontoto/vkm"><img alt="npm" src="https://img.shields.io/npm/v/@miermontoto/vkm?style=flat-square" /></a>
  <a href="https://github.com/miermontoto/vibe-kanban"><img alt="GitHub" src="https://img.shields.io/badge/github-miermontoto%2Fvibe--kanban-blue?style=flat-square" /></a>
</p>

<p align="center">
  <em>Fork of <a href="https://github.com/BloopAI/vibe-kanban">BloopAI/vibe-kanban</a> with additional features and improvements</em>
</p>

![](frontend/public/vibe-kanban-screenshot-overview.png)

## Overview

AI coding agents are increasingly writing the world's code and human engineers now spend the majority of their time planning, reviewing, and orchestrating tasks. vkm streamlines this process, enabling you to:

- Easily switch between different coding agents
- Orchestrate the execution of multiple coding agents in parallel or in sequence
- Quickly review work and start dev servers
- Track the status of tasks that your coding agents are working on
- Centralise configuration of coding agent MCP configs
- Open projects remotely via SSH when running vkm on a remote server

This is a fork of [vibe-kanban](https://github.com/BloopAI/vibe-kanban) with additional features and customizations.

## Installation

Make sure you have authenticated with your favourite coding agent. Then in your terminal run:

```bash
npx @miermontoto/vkm
```

Supported coding agents include Claude Code, Gemini CLI, Amp, and more.

## Support

For bugs and feature requests, please open an issue on this repository.

For upstream vibe-kanban support, see the [original repository](https://github.com/BloopAI/vibe-kanban).

## Contributing

Contributions are welcome! Please open an issue to discuss your proposed changes before submitting a PR.

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (>=18)
- [pnpm](https://pnpm.io/) (>=8)

Additional development tools:
```bash
cargo install cargo-watch
cargo install sqlx-cli
```

Install dependencies:
```bash
pnpm i
```

### Running the dev server

```bash
pnpm run dev
```

This will start the backend. A blank DB will be copied from the `dev_assets_seed` folder.

### Building the frontend

To build just the frontend:

```bash
cd frontend
pnpm build
```

### Build from source (macOS)

1. Run `./local-build.sh`
2. Test with `cd npx-cli && node bin/cli.js`


### Environment Variables

The following environment variables can be configured at build time or runtime:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `POSTHOG_API_KEY` | Build-time | Empty | PostHog analytics API key (disables analytics if empty) |
| `POSTHOG_API_ENDPOINT` | Build-time | Empty | PostHog analytics endpoint (disables analytics if empty) |
| `PORT` | Runtime | Auto-assign | **Production**: Server port. **Dev**: Frontend port (backend uses PORT+1) |
| `BACKEND_PORT` | Runtime | `0` (auto-assign) | Backend server port (dev mode only, overrides PORT+1) |
| `FRONTEND_PORT` | Runtime | `3000` | Frontend dev server port (dev mode only, overrides PORT) |
| `HOST` | Runtime | `127.0.0.1` | Backend server host |
| `DISABLE_WORKTREE_ORPHAN_CLEANUP` | Runtime | Not set | Disable git worktree cleanup (for debugging) |

**Build-time variables** must be set when running `pnpm run build`. **Runtime variables** are read when the application starts.

### Remote Deployment

When running vkm on a remote server (e.g., via systemctl, Docker, or cloud hosting), you can configure your editor to open projects via SSH:

1. **Access via tunnel**: Use Cloudflare Tunnel, ngrok, or similar to expose the web UI
2. **Configure remote SSH** in Settings → Editor Integration:
   - Set **Remote SSH Host** to your server hostname or IP
   - Set **Remote SSH User** to your SSH username (optional)
3. **Prerequisites**:
   - SSH access from your local machine to the remote server
   - SSH keys configured (passwordless authentication)
   - VSCode Remote-SSH extension

When configured, the "Open in VSCode" buttons will generate URLs like `vscode://vscode-remote/ssh-remote+user@host/path` that open your local editor and connect to the remote server.
