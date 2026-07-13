# Bundled Codex Runtime Login Design

## Goal

Allow a user who is already signed in to ChatGPT in their system browser to connect a Codex subscription profile without installing the Codex CLI globally. The bundled official Codex runtime owns only the managed ChatGPT login ceremony. After login, the Electron main process imports the resulting OAuth credential into the existing local Codex proxy, which continues to own token refresh and request forwarding.

## Boundaries

- The feature is local and user-authorized. It must not scrape browser cookies or upload OAuth credentials to a central service.
- The raw access and refresh tokens stay in the Electron main process and must not be returned to the renderer.
- Saving a Codex credential updates only the selected profile; other API profiles, their order, and their settings remain unchanged.
- The runtime is not used for model execution after login.
- The existing Anthropic-compatible Codex proxy remains the request path.

## Current State

- `src/electron/libs/codex/codex-oauth.ts` already parses Codex `auth.json`, normalizes OAuth credentials, exchanges and refreshes tokens, and exposes profile serialization helpers.
- `src/electron/main.ts` contains legacy direct-PKCE IPC handlers, but the renderer does not use them and the flow has no managed local callback lifecycle.
- `src/ui/components/settings/ApiProfilesSettingsPage.tsx` currently asks an agent to read `~/.codex/auth.json`, which makes a global Codex installation appear mandatory.
- `src/electron/libs/codex/codex-anthropic-proxy.ts` already refreshes expiring credentials with a per-profile single-flight guard and persists rotated tokens, but it does not retry once after an upstream 401/403.
- Credentials are currently serialized into `profile.apiKey`; the login flow must not expose the newly acquired raw value to the renderer.

## Chosen Architecture

### 1. Package the official runtime

The desktop package includes the official platform Codex executable as an unpacked runtime resource. Runtime resolution is deterministic:

1. Packaged app resource path.
2. Development dependency path inside the workspace.
3. No fallback to a globally installed `codex` executable for the primary login button.

This proves that the flow works on a machine with no Codex entry on `PATH`.

### 2. Run managed login through `codex app-server`

The Electron main process starts the bundled runtime as `codex app-server` with an isolated per-attempt `CODEX_HOME` under the application user-data directory. The attempt directory contains a minimal `config.toml` with:

```toml
cli_auth_credentials_store = "file"
forced_login_method = "chatgpt"
```

The main process initializes the app-server protocol, calls `account/login/start` with `type: "chatgpt"`, and opens the returned `authUrl` with the system browser. The app-server owns PKCE, the localhost callback listener, token exchange, and login cancellation. If the callback flow fails or is unavailable, the UI can restart the attempt with `type: "chatgptDeviceCode"` and display the returned verification URL and user code.

### 3. Import and hand off the credential

After a successful `account/login/completed` notification:

1. Wait for the runtime to finish writing `<attempt CODEX_HOME>/auth.json`.
2. Read and parse it in the main process using `parseCodexCliAuthCredential`.
3. Require an access token, refresh token, account ID, and a usable expiry.
4. Normalize it with the existing Codex OAuth credential serializer.
5. Patch only the requested Codex profile in the main-process config store.
6. Stop the app-server and delete the isolated attempt directory without calling `account/logout` or `codex logout`, because logout could revoke or invalidate the credential just handed to the proxy.

The IPC completion result contains only safe metadata such as account email, account ID suffix, and expiry. It never contains the credential JSON.

### 4. Continue through the existing proxy

The existing proxy reads the saved profile credential and continues to:

- build the ChatGPT Codex Responses request;
- send the account ID and bearer access token;
- proactively refresh near-expiry credentials;
- serialize refreshes per profile;
- persist both rotated access and refresh tokens.

Add one recovery path: if the upstream returns 401 or 403, force one single-flight refresh from the latest stored refresh token and replay the request once. A second authorization failure is returned to the caller and marks the profile as requiring reconnect; it must not loop.

For a desktop client, request-time refresh plus the one-time authorization retry is preferred over New API's periodic server scheduler because there is no value in rotating an idle local user's token every few minutes.

## IPC and UI Contract

The renderer gets a small managed-login API:

- `codexOAuthRuntimeStart({ profileId, mode })`
- `codexOAuthRuntimeCancel({ attemptId })`
- `onCodexOAuthRuntimeEvent(listener)`

Events are limited to:

- `opening-browser`
- `device-code`
- `completed` with safe account metadata
- `cancelled`
- `failed` with a sanitized message

The Codex profile editor replaces the agent-driven `codex login` instructions with a primary **Connect ChatGPT** button, a progress/cancel state, and a device-code fallback. Manual OAuth JSON import can remain as an advanced recovery path.

## Security and Failure Handling

- Never log app-server protocol messages containing credentials, `auth.json`, authorization codes, or refresh responses.
- Redact bearer tokens and query parameters from errors before forwarding them to the renderer.
- Give each login attempt a random identifier and isolated directory; reject renderer-supplied filesystem paths.
- Limit login to one active attempt per profile and terminate orphaned runtime processes during app shutdown.
- Time out the browser flow and expose cancellation.
- Treat missing packaged runtime as a packaging defect with an actionable error, not as a prompt to install Codex globally.
- Preserve the current credential if a reconnect attempt fails.
- Store the handed-off credential with Electron `safeStorage` where available; renderer-facing profile snapshots expose only connection metadata for Codex profiles.

## Verification

### Unit and source-contract tests

- Runtime resolution chooses the packaged/development binary without consulting global `PATH`.
- App-server JSON-RPC framing handles initialize, login start, success, failure, cancellation, and device-code responses.
- Credential import rejects incomplete or expired `auth.json` files.
- Profile persistence changes only the target profile.
- Renderer events contain no access or refresh token.
- Proxy refresh remains single-flight and a 401/403 is replayed at most once.

### Integration tests

- A fake app-server fixture writes a representative `auth.json`; the main-process login manager imports it and deletes the isolated directory.
- Cancelling kills the child process and leaves the previous profile credential intact.
- A simulated upstream authorization failure refreshes rotated tokens and succeeds on the single replay.

### Packaging checks

- The Windows packaged artifact contains an executable Codex runtime outside ASAR.
- Runtime lookup succeeds with a test environment whose `PATH` has no Codex installation.
- Existing Codex OAuth/provider and proxy tests continue to pass.

## Non-goals

- Reading or exporting ChatGPT browser cookies.
- Returning a raw OAuth token to the user or renderer.
- Centralized credential collection, account pooling, quota resale, or multi-user relay.
- Replacing the existing proxy with the Codex runtime.
- Maintaining a second custom browser PKCE implementation for the primary login path.
