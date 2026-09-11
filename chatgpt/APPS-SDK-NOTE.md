# Apps SDK vs Actions (scoping)

Actions (this package): typed chat + tool calls. Sufficient for all
three GPTs' V1. Ship this first.

Apps SDK native UI later buys: rendered cards (scores, DAGs, standards
diffs), inline approval buttons, device-optimized layouts. It costs: an
MCP server (or equivalent) over the same routes, UI code per surface,
and a second test matrix. Do not start it until the Actions path is
green in-client. The routes don't change — only the renderer does.
