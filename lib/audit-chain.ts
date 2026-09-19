export type AuditNode = {
  index: number;
  timestamp: string;
  type: string;
  payloadHash: string;
  previousHash: string;
  hash: string;
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return "{" + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildAuditChain(input: {
  decision: unknown;
  mission: unknown;
  signals: unknown;
  trace: string[];
}): Promise<AuditNode[]> {
  const steps = [
    ["SIGNALS_ACCEPTED", input.signals],
    ["DECISION_COMPUTED", input.decision],
    ["MISSION_CREATED", input.mission],
    ["TRACE_FINALIZED", input.trace],
  ] as const;

  let previousHash = "GENESIS";
  const chain: AuditNode[] = [];

  for (let index = 0; index < steps.length; index++) {
    const [type, payload] = steps[index];
    const timestamp = new Date().toISOString();
    const payloadHash = await sha256(canonical(payload));
    const hash = await sha256(canonical({ index, timestamp, type, payloadHash, previousHash }));
    const node = { index, timestamp, type, payloadHash, previousHash, hash };
    chain.push(node);
    previousHash = hash;
  }

  return chain;
}
