# Render MCP Server

The public deployment of this app lives on [Render](https://render.com): one Docker web service (`call-calendar`) serving both the API and the SPA statics, declared in `render.yaml` at the repo root (see ADR-0004). The Render [MCP server](https://render.com/docs/mcp-server) (`https://mcp.render.com/mcp`) lets an agent create services, plan and approve deploys from the blueprint, read logs, and update environment variables.

## Authentication model

Render's authorization server accepts only **pre-registered OAuth clients** — the ones baked into Render's official plugins for Claude Code, Codex, and Cursor. It supports neither dynamic client registration (RFC 7591) nor client ID metadata documents, so any MCP client without an official plugin cannot start an OAuth flow: OpenCode reports `Incompatible auth server: does not support dynamic client registration`.

Two working options:

1. **Official plugin (OAuth, no keys to manage)** — Claude Code: `/plugin install render@claude-plugins-official`, Cursor: `/add-plugin render`, Codex: `codex mcp add render --url https://mcp.render.com/mcp --oauth-client-id codex`.
2. **API key through an environment variable** — works with any MCP client, including OpenCode. The key lives in your shell environment, never in the repository.

## Connecting

### OpenCode (the agent of this project)

`opencode.json` already defines the remote server and reads the key from the environment:

```jsonc
{
  "mcp": {
    "servers": {
      "render": {
        "type": "remote",
        "url": "https://mcp.render.com/mcp",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:RENDER_API_KEY}"
        }
      }
    }
  }
}
```

1. Create an API key: [Account Settings → API Keys](https://dashboard.render.com/u/settings?add-api-key).
2. Export it in the shell that launches OpenCode (shell profile or a one-off `export RENDER_API_KEY="rnd_…"`).
3. Start (or restart) OpenCode from that shell so the process sees the variable, then verify:

```sh
opencode mcp list # should show ✓ render connected
```

### Claude Code

Prefer the official plugin: `/plugin install render@claude-plugins-official` (OAuth). For a manual `.mcp.json` at the repo root (keep it untracked), pass the key via header — Claude Code expands `${VAR}` from the environment:

```json
{
  "mcpServers": {
    "render": {
      "type": "http",
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer ${RENDER_API_KEY}"
      }
    }
  }
}
```

`"type": "http"` is required: a `url` entry without a `type` is read as a stdio server and fails.

### Cursor

Prefer the official plugin: `/add-plugin render` (OAuth). For a manual `.cursor/mcp.json` (keep it untracked):

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:RENDER_API_KEY}"
      }
    }
  }
}
```

## Usage

- The deployment is managed from `render.yaml` (blueprint). The MCP server's Blueprint tools are in public alpha: `create_blueprint` (point it at this repository, branch `main`, path `render.yaml`), then `plan_blueprint`, review the plan with the user, and only then `approve_blueprint`.
- A service created by hand must match `render.yaml`: name `call-calendar`, Docker runtime, plan `free`, region `frankfurt`, health check `/api/health`. Note that `create_web_service` does not accept the `free` plan — prefer the blueprint path.
- The public URL of the deployment is in the README.

## Safety

- **No API keys in the repository, ever.** Keys live in the shell environment; `{env:…}` and `${…}` references in committed config files are placeholders, not secrets. Never paste a key into chat, issues, or commits.
- Blueprint tools apply infrastructure changes: plan first, review with the user, approve only after explicit authorization.
- The MCP server can trigger deploys and rewrite a service's environment variables — review prompts that would change a running service before confirming them.
