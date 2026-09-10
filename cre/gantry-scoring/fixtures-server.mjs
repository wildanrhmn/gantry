// Serves the features endpoint the workflow reads, using shapes taken from a real
// scan of mainnet blocks 25940000-25941500 so the simulation exercises the router
// guard against numbers that actually occurred.
import { createServer } from "node:http";

const traders = [
  // Uniswap's Universal Router. Looks like the worst offender until you count originators.
  { id: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af", swaps: 3580, blocks: 1500,
    sandwiches: 23, victimsHarmed: 31, roundTrips: 900, originators: 1319,
    firstBlock: 25940000, lastBlock: 25941500 },
  // A dedicated sandwich bot: same behaviour, one originator.
  { id: "0x9205a569b0ff45df1e4f5ae48e21bc7f0656f0bb", swaps: 680, blocks: 300,
    sandwiches: 11, victimsHarmed: 11, roundTrips: 120, originators: 1,
    firstBlock: 25940000, lastBlock: 25941500 },
  { id: "0x76f30e3f75437fb862b8d2c4d80a671bceba5b1a", swaps: 210, blocks: 140,
    sandwiches: 6, victimsHarmed: 6, roundTrips: 60, originators: 1,
    firstBlock: 25940100, lastBlock: 25941400 },
  // Long history, never sandwiched.
  { id: "0xaaf4b27e0d0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", swaps: 240, blocks: 240,
    sandwiches: 0, victimsHarmed: 0, roundTrips: 2, originators: 1,
    firstBlock: 25930000, lastBlock: 25941500 },
  // Barely seen, so it stays unknown rather than clean.
  { id: "0xbbbb1111111111111111111111111111111111bb", swaps: 3, blocks: 3,
    sandwiches: 0, victimsHarmed: 0, roundTrips: 0, originators: 1,
    firstBlock: 25941400, lastBlock: 25941450 },
];

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: { traders } }));
  });
}).listen(8799, () => console.log("features fixtures on :8799"));
