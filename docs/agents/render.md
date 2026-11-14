# Render MCP Server

The public deployment of this app lives on [Render](https://render.com): one Docker web service (`call-calendar`) serving both the API and the SPA statics, declared in `render.yaml` at the repo root (see ADR-0004). The Render [MCP server](https://render.com/docs/mcp-server) (`https://mcp.render.com/mcp`) lets an agent create services, trigger deploys, read logs, and update environment variables.

## Connecting

### OpenCode

The project config `opencode.json` already defines the remote server:

```jsonc
{
  "mcp": {
    "servers": {
      "render": {
        "type": "remote",
        "url": "https://mcp.render.com/mcp"
      }
    }
  }
}
```

Authenticate (OAuth in the browser; tokens are stored outside the repository):

```sh
opencode mcp auth render
# or inside OpenCode: /mcps → render → sign in
```

Verify: `opencode mcp list` should show `✓ render connected`.

### Claude Code

Claude Code does not read `opencode.json`. Create `.mcp.json` at the repo root (keep it untracked):

```json
{
  "mcpServers": {
    "render": {
      "type": "http",
      "url": "https://mcp.render.com/mcp"
    }
  }
}
```

`"type": "http"` is required: a `url` entry without a `type` is read as a stdio server and fails. On first run, approve the project server, then authenticate via `/mcp` → render → Authenticate.

### Cursor

Cursor reads `.cursor/mcp.json` (keep it untracked):

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp"
    }
  }
}
```

Cursor performs the OAuth flow automatically on first use.

## Usage

- Scope every session to a workspace first (MCP actions are workspace-scoped): `list_workspaces` → `set_workspace`, or prompt "Set my Render workspace to …".
- The deployed service is the web service `call-calendar`. Its parameters must match `render.yaml`; the public URL is in the README.
- To recreate the service, prefer the dashboard "Blueprint" flow (it applies `render.yaml`) — the MCP server cannot apply blueprints, and its `create web service` tool does not cover every option.

## Safety

- **No API keys in the repository, ever.** OAuth keeps tokens out of the repo; in non-interactive environments pass an API key through an environment variable (`RENDER_API_KEY`), never through a committed file.
- The MCP server can trigger deploys and rewrite a service's environment variables — review prompts that would change a running service before confirming them.
