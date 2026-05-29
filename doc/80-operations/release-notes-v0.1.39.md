# v0.1.39 Release Notes

## Highlights

- Fixed third-party Anthropic-compatible gateways failing with `messages[].role: unknown variant system`.
- Added a local compatibility proxy for custom Anthropic-style profiles so system-role messages are folded into the top-level `system` field before forwarding.
- Kept official Anthropic and Codex OAuth routes on their existing direct paths.
- Moved the "changed files" card to the tail of process groups so the main execution detail appears first and file previews sit at the end of the turn.

## Verification

- `npm run transpile:electron`
- `npm run build`
- `node --test dist-test\test\electron\anthropic-compat-proxy.test.js`
- `node --test dist-test\test\electron\codex-oauth-provider.test.js`
- `node --test test\electron\preview-open-routing.test.ts`
- `npx eslint src\electron\libs\anthropic\anthropic-compat.ts src\electron\libs\anthropic\anthropic-compat-proxy.ts src\electron\libs\claude\claude-settings.ts src\electron\main.ts src\ui\components\chat\ProcessGroupCard.tsx test\electron\anthropic-compat-proxy.test.ts test\electron\codex-oauth-provider.test.ts test\electron\preview-open-routing.test.ts`
- Dev self-test with `deepseek-v4-pro` from `D:\tool\tech-cc-hub\test`.
