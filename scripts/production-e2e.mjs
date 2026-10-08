const cases = [
  ["deterministic","oblicz 2+2","none",""],
  ["universal-ai","Napisz jedno krótkie zdanie potwierdzające działanie Core Engine AI.","none",""],
  ["website","stwórz stronę WWW dla restauracji w Krakowie z sekcją menu i kontaktem","website","multitask.website.build"],
  ["data","przygotuj wykres KPI dla sprzedaży miesięcznej","data","multitask.data.analyze"],
  ["document","utwórz dokument PDF z krótkim raportem o Core Engine AI","file","multitask.document.create"],
  ["weather","sprawdź pogodę w Krakowie","data","multitask.weather.current"]
];

const base = "https://core-engine-34uu.onrender.com";

async function runCase([id, task, expectedArtifact, expectedTool]) {
  const response = await fetch(base + "/api/agent", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({task, project: "core-engine-production-e2e"})
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(id + ": API failure " + response.status);
  if (!data.performance?.requestId) throw new Error(id + ": missing requestId");
  if (data.verification?.passed !== true) throw new Error(id + ": verification failed");
  if (data.evidencePersistence?.persisted !== true) throw new Error(id + ": evidence persistence failed");

  const artifact = data.artifact || {};
  if (expectedArtifact !== "none") {
    if (artifact.type !== expectedArtifact || artifact.status !== "EXECUTED") {
      throw new Error(id + ": artifact mismatch " + JSON.stringify(artifact));
    }
    if (data.verification?.checks?.executionEvidence !== true) throw new Error(id + ": missing executionEvidence");
    const run = data.evidence?.toolRuns?.[0];
    if (!run || run.status !== "EXECUTED") throw new Error(id + ": missing executed tool run");
    if (expectedTool && run.tool !== expectedTool) throw new Error(id + ": tool mismatch " + JSON.stringify(run));
  } else if (artifact.status === "FAILED") {
    throw new Error(id + ": unexpected failed artifact");
  }

  console.log("CORE_ENGINE_E2E_PASS", id, data.performance.requestId);
}

for (const c of cases) await runCase(c);
console.log("CORE_ENGINE_PRODUCTION_E2E_PASS");
