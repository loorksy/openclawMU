# Models & Failover

## Selection and auth

- **Models config + CLI** — model identifiers, defaults, per-agent overrides.
- **Auth profile rotation** — OAuth vs API keys, with fallbacks for resilience.

OpenClaw supports any model in principle. The recommended baseline is **Anthropic Pro/Max + Opus 4.6** for long-context strength and better prompt-injection resistance.

## Provider OAuth

- **Anthropic** (Claude Pro/Max).
- **OpenAI** (ChatGPT / Codex).

OAuth flows are walked through in the onboarding wizard.

## Failover

Auth profile rotation handles primary / fallback configurations. When one provider hits a rate limit or auth error, the runtime can fall back to a configured alternate.

## Per-session model

A session's model can be patched at runtime (admin scope) via `sessions.patch`. Keys include `model`, `thinkingLevel`, `verboseLevel`, `sendPolicy`, and `groupActivation`.

## See also

- [Architecture](architecture.md).
- The upstream `docs/concepts/models.md`, `model-failover.md`, `model-providers.md`, and `oauth.md` for full provider details.
