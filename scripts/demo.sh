#!/usr/bin/env bash
# Runs the whole loop on a local chain: stand up a pool, let a bot sandwich a
# trader, score it from chain data, publish the tiers, then swap again and watch
# the two callers pay different fees.
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
PK=${PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
ME=${ME:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}
ROOT=$(cd "$(dirname "$0")/.." && pwd)

MINLIM=4295128740
MAXLIM=1461446703485210103287273052203988822378723970341
SIG='swap((address,address,uint24,int24,address),(bool,int256,uint160),(bool,bool),bytes)'

echo "==> deploying venue"
cd "$ROOT/contracts"
PRIVATE_KEY=$PK forge script script/Setup.s.sol:Setup --rpc-url "$RPC" --broadcast \
  --disable-code-size-limit 2>&1 | grep -E "^  [A-Z0-9_]+=" | sed 's/^  //' > /tmp/gantry.env
cat /tmp/gantry.env
source /tmp/gantry.env

KEY="($TOKEN0,$TOKEN1,8388608,60,$GANTRY)"

echo "==> sandwiching a trader in one block"
N=$(cast nonce "$ME" --rpc-url "$RPC")
cast rpc anvil_setAutomine false --rpc-url "$RPC" > /dev/null
cast send "$BOT_ROUTER"    "$SIG" "$KEY" "(true,-100000000000000000,$MINLIM)" "(false,false)" "0x" \
  --private-key "$PK" --rpc-url "$RPC" --async --nonce "$N" > /dev/null
cast send "$RETAIL_ROUTER" "$SIG" "$KEY" "(true,-50000000000000000,$MINLIM)"  "(false,false)" "0x" \
  --private-key "$PK" --rpc-url "$RPC" --async --nonce "$((N + 1))" > /dev/null
cast send "$BOT_ROUTER"    "$SIG" "$KEY" "(false,-100000000000000000,$MAXLIM)" "(false,false)" "0x" \
  --private-key "$PK" --rpc-url "$RPC" --async --nonce "$((N + 2))" > /dev/null
cast rpc anvil_mine --rpc-url "$RPC" > /dev/null
cast rpc anvil_setAutomine true --rpc-url "$RPC" > /dev/null

echo "==> scoring from chain data"
cd "$ROOT/scorer"
node src/cli.ts --manager="$MANAGER" --rpc="$RPC" --from=0 --out=/tmp/tiers.json

echo "==> publishing tiers"
ADDRS=$(jq -r '[.addresses[].address] | join(",")' /tmp/tiers.json)
TIERS=$(jq -r '[.addresses[].tier] | join(",")' /tmp/tiers.json)
cast send "$ORACLE" "setTiers(address[],uint8[])" "[$ADDRS]" "[$TIERS]" \
  --private-key "$PK" --rpc-url "$RPC" > /dev/null

echo "==> identical swaps, different price"
bal() { cast call "$TOKEN1" "balanceOf(address)(uint256)" "$ME" --rpc-url "$RPC" | awk '{print $1}'; }
b0=$(bal)
cast send "$BOT_ROUTER" "$SIG" "$KEY" "(true,-10000000000000000,$MINLIM)" "(false,false)" "0x" \
  --private-key "$PK" --rpc-url "$RPC" > /dev/null
b1=$(bal)
cast send "$RETAIL_ROUTER" "$SIG" "$KEY" "(true,-10000000000000000,$MINLIM)" "(false,false)" "0x" \
  --private-key "$PK" --rpc-url "$RPC" > /dev/null
b2=$(bal)

python3 -c "
bot=$b1-$b0; retail=$b2-$b1
print(f'  sandwicher receives {bot}')
print(f'  trader     receives {retail}')
print(f'  difference {retail-bot} ({(retail-bot)/bot*100:.2f}%)')"
