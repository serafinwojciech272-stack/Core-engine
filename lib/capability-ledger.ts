type CapabilityLedgerEvent = "CAPABILITY_APPROVED" | "CAPABILITY_EXECUTED" | "CAPABILITY_OUTCOME_RECORDED";

type LedgerConfig = { url: string; key: string };

function cfg(): LedgerConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function request(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function recordCapabilityLedgerEvent(
  missionId: string,
  eventType: CapabilityLedgerEvent,
  metadata: Record<string, unknown>,
) {
  const c = cfg();
  if (!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const response = await request(`${c.url}/rest/v1/ce_events`, {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "return=minimal" },
    body: JSON.stringify({
      mission_id: missionId,
      event_type: eventType,
      actor_type: "system",
      metadata,
    }),
  });
  if (!response.ok) throw new Error(`SUPABASE_CAPABILITY_EVENT_${response.status}`);
}

export async function isPersistedCapabilityApproved(missionId: string, capabilityActionId: string) {
  const c = cfg();
  if (!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const url = new URL(`${c.url}/rest/v1/ce_events`);
  url.searchParams.set("mission_id", `eq.${missionId}`);
  url.searchParams.set("event_type", "eq.CAPABILITY_APPROVED");
  url.searchParams.set("metadata->>capabilityActionId", `eq.${capabilityActionId}`);
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");
  const response = await request(url.toString(), { headers: headers(c.key) });
  if (!response.ok) throw new Error(`SUPABASE_CAPABILITY_APPROVAL_READ_${response.status}`);
  const rows = (await response.json()) as Array<{ id: string }>;
  return rows.length > 0;
}
