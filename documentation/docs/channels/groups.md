# Group Routing

Groups require explicit routing rules. OpenClaw uses mention gating, reply tags, and per-channel chunking to decide when to respond.

## Group activation

- **Mention gating** — by default, the bot only responds in groups when mentioned. Set per-group via `channels.<name>.groups.<groupId>.requireMention`.
- **Mention patterns** — configure custom mention strings under `messages.groupChat.mentionPatterns`. Example: `["@openclaw"]`.
- **Reply tags** — replies to the bot's own messages trigger a response without needing a fresh mention.

## Example

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
}
```

## Per-channel chunking

Group routing also handles channel-specific chunking and routing rules (message length caps, reply threading, etc.). See per-channel docs under `docs/channels/` in the repo for the specific rules.

## Owner-only group commands

Some chat commands are owner-only when sent in groups. See the chat commands section in the upstream `README.md` for the canonical list.

## See also

- [DM policy & pairing](pairing.md).
- [Channels overview](index.md).
