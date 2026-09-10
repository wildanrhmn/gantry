# gantry substreams

Extracts Uniswap v4 swaps and finds sandwiches in them.

`map_swaps` is deliberately generic, so any v4 pipeline can reuse it. `map_sandwiches`
consumes its output and looks for one address opening and closing a position around
somebody else's trade inside a single block and pool.
