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
  features_url: string;
  max_addresses: number;
  secrets_ids: { scoring_params_id: string; features_key_id: string };
  evms?: EvmWriteConfig[];
};

const FEATURES_QUERY = `query($n: Int!) {
  traders(first: $n, orderBy: swaps, orderDirection: desc) {
    id swaps blocks sandwiches victimsHarmed roundTrips originators firstBlock lastBlock
  }
}`;

export const fetchFeatures = (
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  apiKey: string,
  limit: number,
): AddressFeatures[] => {
  const response = client
    .sendRequest(runtime, {
      url,
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: new TextEncoder().encode(JSON.stringify({ query: FEATURES_QUERY, variables: { n: limit } })),
    })
    .result();

  const decoded = JSON.parse(new TextDecoder().decode(response.body)) as {
    data?: { traders?: Record<string, string>[] };
  };

  return (decoded.data?.traders ?? []).map((t) => ({
    address: t.id,
    swaps: Number(t.swaps ?? 0),
    blocks: Number(t.blocks ?? 0),
    sandwiches: Number(t.sandwiches ?? 0),
    victimsHarmed: Number(t.victimsHarmed ?? 0),
    roundTrips: Number(t.roundTrips ?? 0),
    originators: Number(t.originators ?? 0),
    firstBlock: Number(t.firstBlock ?? 0),
    lastBlock: Number(t.lastBlock ?? 0),
  }));
};

export const onCronTrigger = async (runtime: TeeRuntime<Config>): Promise<string> => {
  const { features_url, max_addresses, secrets_ids, evms } = runtime.config;

  const secrets = runtime
    .getSecrets([{ id: secrets_ids.scoring_params_id }, { id: secrets_ids.features_key_id }])
    .result();

  const params = JSON.parse(secrets[secrets_ids.scoring_params_id].value) as ScoringParams;
  const featuresKey = secrets[secrets_ids.features_key_id].value;
  runtime.log("gantry-secrets-ok");

  const features = fetchFeatures(runtime, new HTTPClient(), features_url, featuresKey, max_addresses);

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
      maxSecrets: 2,
      restrictions: [
        { exactSecret: { id: secrets_ids.scoring_params_id, namespace: "main" } },
        { exactSecret: { id: secrets_ids.features_key_id, namespace: "main" } },
      ],
    },
  };
};

export const initWorkflow = (config: Config): Workflow<Config> => {
  if (!config.schedule || !config.features_url) {
    throw new Error("config requires schedule and features_url");
  }
  if (!config.secrets_ids?.scoring_params_id || !config.secrets_ids?.features_key_id) {
    throw new Error("config requires secrets_ids fields");
  }

  const cron = new CronCapability();

  return [
    handlerInTee(cron.trigger({ schedule: config.schedule }), onCronTrigger, {}, {
      preHook: (cfg: Config) => buildRestrictions(cfg),
    }),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configParser: (raw: Uint8Array) => JSON.parse(new TextDecoder().decode(raw)) as Config,
  });
  await runner.run(initWorkflow);
}
