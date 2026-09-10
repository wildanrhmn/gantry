# gantry mcp

Answers questions about a Gantry pool from an MCP client.

```bash
GANTRY_SUBGRAPH=https://api.studio.thegraph.com/query/<id>/gantry/<version> \
  node src/server.ts
```

Tools: `lookup_address`, `recent_tolls`, `venue_stats`, `worst_offenders`.

`lookup_address` is the one that matters - paste any address and it explains what it
would be charged and why, straight out of indexed history.
