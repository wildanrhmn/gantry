import {
  CronCapability,
  EVMClient,
  EVMRestrictor,
  HTTPClient,
  HTTPClientRestrictor,
  Runner,
  TxStatus,
  bytesToHex,
  getNetwork,
  handlerInTee,
  hexToBase64,
  type TeeRuntime,
  type Workflow,
} from "@chainlink/cre-sdk";
import {
  encodeTierReport,
  isSharedInfrastructure,
  scoreAddress,
  type AddressFeatures,
  type ScoringParams,
} from "./scoring.ts";

export * from "./scoring.ts";

type EvmWriteConfig = {
  chain_selector_name: string;
  receiver_address: string;
  gas_limit: string;
};

export type Config = {
  schedule: string;
  /** The behaviour subgraph. Read straight from The Graph, not from a server of ours. */
  subgraph_url: string;
  /** Reverted PoolManager calls per address, the Substreams run committed to the repo. */
  traces_url: string;
  max_addresses: number;
  secrets_ids: { scoring_params_id: string };
  evms?: EvmWriteConfig[];
};

const FEATURES_QUERY = `query($n: Int!) {
  mainnetTraders(first: $n, orderBy: swaps, orderDirection: desc) {
    id swaps blocks sandwiches victims roundTrips originators firstBlock lastBlock
  }
}`;

const text = (body: Uint8Array) => new TextDecoder().decode(body);

/**
 * Behaviour comes from the subgraph; reverted attempts come from the Substreams run.
 * They are separate calls because they are separate capabilities: a reverted
 * transaction writes no logs, so the subgraph structurally cannot report one.
 */
export const fetchFeatures = (
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  subgraphUrl: string,
  tracesUrl: string,
  limit: number,
): AddressFeatures[] => {
  const behaviour = client
    .sendRequest(runtime, {
      url: subgraphUrl,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new TextEncoder().encode(JSON.stringify({ query: FEATURES_QUERY, variables: { n: limit } })),
    })
    .result();

  const traces = client.sendRequest(runtime, { url: tracesUrl, method: "GET" }).result();

  const decoded = JSON.parse(text(behaviour.body)) as {
    data?: { mainnetTraders?: Record<string, string>[] };
  };
  const reverts = (JSON.parse(text(traces.body)) as { perAddress?: Record<string, number> })
    .perAddress ?? {};

  return (decoded.data?.mainnetTraders ?? []).map((t) => ({
    address: t.id,
    swaps: Number(t.swaps ?? 0),
    blocks: Number(t.blocks ?? 0),
    sandwiches: Number(t.sandwiches ?? 0),
    victimsHarmed: Number(t.victims ?? 0),
    roundTrips: Number(t.roundTrips ?? 0),
    originators: Number(t.originators ?? 0),
    firstBlock: Number(t.firstBlock ?? 0),
    lastBlock: Number(t.lastBlock ?? 0),
    failedAttempts: Number(reverts[t.id] ?? 0),
  }));
};

export const onCronTrigger = async (runtime: TeeRuntime<Config>): Promise<string> => {
  const { subgraph_url, traces_url, max_addresses, secrets_ids, evms } = runtime.config;

  const secrets = runtime
    .getSecrets([{ id: secrets_ids.scoring_params_id }])
    .result();

  const params = JSON.parse(secrets[secrets_ids.scoring_params_id].value) as ScoringParams;
  runtime.log("gantry-secrets-ok");

  const features = fetchFeatures(
    runtime,
    new HTTPClient(),
    subgraph_url,
    traces_url,
    max_addresses,
  );

  // Shared infrastructure is dropped rather than published as neutral, so a router
  // never occupies a slot in the report at all.
  const scored = features
    .filter((f) => !isSharedInfrastructure(f, params))
    .map((f) => ({ address: f.address, tier: scoreAddress(f, params) }));

  runtime.log(`gantry-scored addresses=${scored.length} of=${features.length}`);
  if (scored.length === 0) return "nothing to publish";

  const target = evms?.[0];
  if (!target) return `scored ${scored.length} addresses, no evm target configured`;

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: target.chain_selector_name });
  if (!network) throw new Error(`network not found: ${target.chain_selector_name}`);

  const donRuntime = runtime.usingTheDons();
  const report = donRuntime
    .report({
      encodedPayload: hexToBase64(encodeTierReport(scored)),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const write = new EVMClient(network.chainSelector.selector)
    .writeReport(donRuntime, {
      receiver: target.receiver_address,
      report,
      gasConfig: { gasLimit: target.gas_limit },
    })
    .result();

  if (write.txStatus !== TxStatus.SUCCESS) throw new Error(`onchain write failed: ${write.txStatus}`);
  return bytesToHex(write.txHash || new Uint8Array(32));
};

export const buildRestrictions = (config: Config) => {
  const httpRestrictor = new HTTPClientRestrictor();
  const restrictions = [
    httpRestrictor.limitSendRequest(2),
    {
      method: {
        id: "consensus@1.0.0-alpha",
        method: "Report",
        maxCalls: 1,
      },
    },
  ];

  const target = config.evms?.[0];
  if (target?.chain_selector_name) {
    const network = getNetwork({ chainFamily: "evm", chainSelectorName: target.chain_selector_name });
    if (network) {
      restrictions.push(new EVMRestrictor(BigInt(network.chainSelector.selector)).limitWriteReport(1));
    }
  }

  const { secrets_ids } = config;

  return {
    capabilities: {
      type: "CAPABILITY_RESTRICTION_TYPE_CLOSED" as const,
      maxTotalCalls: 6,
      restrictions,
    },
    secrets: {
      maxSecrets: 1,
      restrictions: [{ exactSecret: { id: secrets_ids.scoring_params_id, namespace: "main" } }],
    },
  };
};

export const initWorkflow = (config: Config): Workflow<Config> => {
  if (!config.schedule || !config.subgraph_url || !config.traces_url) {
    throw new Error("config requires schedule, subgraph_url and traces_url");
  }
  if (!config.secrets_ids?.scoring_params_id) {
    throw new Error("config requires secrets_ids.scoring_params_id");
  }

  const cron = new CronCapability();

  return [
    handlerInTee(cron.trigger({ schedule: config.schedule }), onCronTrigger, {}, {
      preHook: (cfg: Config) => buildRestrictions(cfg),
    }),
  ];
};

/** Used when the runtime hands the workflow an empty config, as it does in simulation. */
const DEFAULT_CONFIG: Config = {
  schedule: "0 */15 * * * *",
  subgraph_url: "http://127.0.0.1:8799/graphql",
  traces_url: "http://127.0.0.1:8799/traces.json",
  max_addresses: 50,
  secrets_ids: { scoring_params_id: "gantry_scoring_params" },
  evms: [
    {
      chain_selector_name: "ethereum-testnet-sepolia",
      receiver_address: "0x0000000000000000000000000000000000000000",
      gas_limit: "800000",
    },
  ],
};

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configParser: (raw: Uint8Array) => {
      const text = new TextDecoder().decode(raw);
      if (!text || text.trim() === "") return DEFAULT_CONFIG;
      return JSON.parse(text) as Config;
    },
  });
  await runner.run(initWorkflow);
}
