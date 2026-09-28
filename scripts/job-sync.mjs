const base = process.env.JOB_AGENT_URL || "https://job-agent-live.onrender.com";
const url = base.replace(/\/$/, "") + "/api/jobs/sync";
const response = await fetch(url, {
  method: "GET",
  headers: {
    origin: base,
    accept: "application/json"
  }
});
const body = await response.text();
console.log(JSON.stringify({ status: response.status, body }));
if (!response.ok) process.exit(1);
