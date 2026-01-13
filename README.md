<h1 align="center">vkm</h1>

<p align="center">Task management and orchestration for AI coding agents</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@miermontoto/vkm"><img alt="npm" src="https://img.shields.io/npm/v/@miermontoto/vkm?style=flat-square" /></a>
  <a href="https://github.com/miermontoto/vibe-kanban"><img alt="GitHub" src="https://img.shields.io/badge/github-miermontoto%2Fvibe--kanban-blue?style=flat-square" /></a>
</p>

<p align="center">
  <em>fork of <a href="https://github.com/BloopAI/vibe-kanban">BloopAI/vibe-kanban</a> with additional features and improvements</em>
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
sh run.sh
```
