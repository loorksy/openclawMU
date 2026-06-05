# Getting Started

OpenClaw runs as a single Gateway process on your machine (or a remote server). The Gateway is the control plane for channels, sessions, tools, and events.

The preferred setup is the onboarding wizard (`openclaw onboard`) in your terminal, which guides you step by step through the gateway, workspace, channels, and skills. The CLI wizard works on **macOS, Linux, and Windows (via WSL2; strongly recommended)** and supports npm, pnpm, or bun.

## What you need

- **Node 22 or later**.
- An API key or OAuth account for a model provider. Anthropic (Claude Pro/Max) and OpenAI (ChatGPT/Codex) are supported via OAuth.
- Optional: chat-app accounts you want to bridge (WhatsApp, Telegram, Discord, etc.).

> **Model note**: while any model is supported, the recommended baseline is **Anthropic Pro/Max + Opus 4.6** for long-context strength and better prompt-injection resistance.

## Choose your path

- [Install](install.md) — install the CLI globally and run the onboarding wizard.
- [Quick start](quickstart.md) — minimal commands to get a Gateway running.
- [Onboarding wizard](wizard.md) — what the wizard does and how to drive it.
- [From source](from-source.md) — clone and build for development.
- [Updating](updating.md) — upgrading between releases and switching channels.

## Multi-tenant first?

If you're spinning up OpenClawMU specifically for tenant isolation, jump to [Multi-Tenancy](../multi-tenancy/index.md). The base install steps are the same — multi-tenancy is enabled automatically when tenant tokens are used.
