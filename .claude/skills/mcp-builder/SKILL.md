---
name: mcp-builder
description: Build MCP (Model Context Protocol) servers that expose tools, resources, and prompts to Claude. Use this skill when the user wants to create a new MCP server, add tools to an existing one, or connect Claude to external data sources or APIs.
---

This skill guides building MCP servers from scratch or extending existing ones.

## When to Apply

- User wants to "build an MCP server", "create an MCP tool", or "connect Claude to X"
- User wants to expose custom data, APIs, or automations to Claude
- User wants to extend Claude Code with new capabilities

## MCP Concepts

- **Tools** — functions Claude can call (e.g., query a DB, call an API)
- **Resources** — data Claude can read (e.g., files, database rows)
- **Prompts** — reusable prompt templates Claude can reference

## Recommended Stack

- **TypeScript SDK**: `@modelcontextprotocol/sdk` (preferred)
- **Python SDK**: `mcp` package
- Transport: `stdio` for local tools, `http/sse` for remote servers

## Quick Start (TypeScript)

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "my_tool",
      description: "Does something useful",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "my_tool") {
    const { query } = request.params.arguments as { query: string };
    return { content: [{ type: "text", text: `Result for: ${query}` }] };
  }
  throw new Error("Unknown tool");
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Registering in Claude Code

Add to `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"]
    }
  }
}
```

## Notes

- Use `plugin-dev` plugin (installed) for detailed MCP integration guidance within Claude Code plugins.
- See [MCP docs](https://modelcontextprotocol.io) for full specification.
