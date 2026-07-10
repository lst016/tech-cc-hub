# Upstream provenance

This directory vendors [Xiangyu-CAS/codex-canvas](https://github.com/Xiangyu-CAS/codex-canvas) as a Git subtree.

- Source: `https://github.com/Xiangyu-CAS/codex-canvas.git`
- Revision: `98eb54e16b30e3c68e617482b8e886e0d771a7ed`
- Imported release: `v0.2.1`

Refresh from upstream with:

```powershell
git subtree pull --prefix=plugins/codex-canvas https://github.com/Xiangyu-CAS/codex-canvas.git main --squash
```

Local host integration is intentionally limited to:

- `tech-cc-hub.plugin.json`
- `src/tech-cc-hub-transport.mjs`
- `src/codex-chat.mjs`
- `src/server.mjs`
- `public/app.js` for the optional send-note prompt and delivery wording
- `scripts/tech-cc-hub-transport-smoke.mjs`

The transport activates only when the Tech CC Hub process supplies the per-launch loopback bridge environment. Without it, upstream Codex app-server behavior remains unchanged.
