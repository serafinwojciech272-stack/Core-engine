// Tool registry for the agent loop. The model chooses tools by name; arguments are validated here
// and passed through unchanged — no keyword re-routing (fixes audit finding R1).
import type { AgentTool, ToolResult } from "@/lib/agent-loop/contracts";
import { executeMultiTaskAction } from "@/lib/multitask-engine";
import { sandboxToolFromEnv } from "@/lib/agent-loop/sandbox";

const MAX_FILE_BYTES = 200_000;
const MAX_FILES = 200;
const READ_CHUNK = 5_000; // stays under the 6000-char tool output clip in the runner

function str(args: Record<string, unknown>, key: string, max = 100_000): string {
  const v = args[key];
  if (typeof v !== "string" || !v.trim()) throw new Error(`ARG_REQUIRED:${key}`);
  if (v.length > max) throw new Error(`ARG_TOO_LONG:${key}`);
  return v;
}

function safePath(path: string) {
  const p = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p || p.includes("..") || p.length > 200 || !/^[\w.\-/ ]+$/.test(p)) throw new Error("INVALID_PATH");
  return p;
}

async function multitask(actionId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const { receipt, artifact } = await executeMultiTaskAction(actionId, input);
  if (receipt.status !== "EXECUTED" || !artifact || artifact.status !== "EXECUTED") {
    return { status: "FAILED", output: { error: receipt.message || "TOOL_FAILED" } };
  }
  const isBinary = Boolean(artifact.dataUrl);
  return {
    status: "EXECUTED",
    output: { artifact: artifact.title, type: artifact.type, provider: artifact.provider, text: artifact.text?.slice(0, 4000), filename: artifact.filename },
    artifacts: [{
      name: artifact.filename || artifact.title, type: artifact.type, mimeType: artifact.mimeType, provider: artifact.provider,
      content: isBinary ? artifact.text : artifact.html || artifact.text, dataUrl: artifact.dataUrl,
    }],
  };
}

function parseSeries(data: string): Array<{ label: string; value: number }> {
  const trimmed = data.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((row) => {
        const entries = Object.entries(row as Record<string, unknown>);
        const valueEntry = entries.find(([, v]) => Number.isFinite(Number(v)));
        return { label: String(entries[0]?.[1] ?? ""), value: Number(valueEntry?.[1]) };
      }).filter((p) => Number.isFinite(p.value));
    }
  } catch { /* fall through to CSV */ }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  return lines.slice(1).map((line) => {
    const cells = line.split(/[;,\t]/).map((c) => c.trim());
    const value = cells.slice(1).map(Number).find((n) => Number.isFinite(n));
    return { label: cells[0] ?? "", value: Number(value) };
  }).filter((p) => Number.isFinite(p.value));
}

export const builtinTools: AgentTool[] = [
  {
    name: "workspace_write",
    description: "Write a text file (spec, SQL schema, source code, tests, notes) into the run workspace. Overwrites existing files.",
    parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false },
    sideEffect: false,
    async execute(args, { run }) {
      const path = safePath(str(args, "path", 300));
      const content = str(args, "content", MAX_FILE_BYTES);
      if (!(path in run.workspace) && Object.keys(run.workspace).length >= MAX_FILES) throw new Error("WORKSPACE_FILE_LIMIT");
      return { status: "EXECUTED", output: { written: path, bytes: content.length }, workspaceWrites: { [path]: content } };
    },
  },
  {
    name: "workspace_read",
    description: "Read a workspace file in chunks of up to 5000 characters. Use `offset` (from nextOffset) to continue.",
    parameters: { type: "object", properties: { path: { type: "string" }, offset: { type: "integer", minimum: 0 } }, required: ["path"], additionalProperties: false },
    sideEffect: false,
    async execute(args, { run }) {
      const path = safePath(str(args, "path", 300));
      if (!(path in run.workspace)) return { status: "FAILED", output: { error: "FILE_NOT_FOUND", path } };
      const file = run.workspace[path];
      const offset = Math.max(0, Math.min(Number(args.offset) || 0, file.length));
      const chunk = file.slice(offset, offset + READ_CHUNK);
      const nextOffset = offset + chunk.length < file.length ? offset + chunk.length : null;
      return { status: "EXECUTED", output: { path, totalChars: file.length, offset, nextOffset, content: chunk } };
    },
  },
  {
    name: "workspace_list",
    description: "List files in the run workspace with their sizes.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    sideEffect: false,
    async execute(_args, { run }) {
      return { status: "EXECUTED", output: Object.entries(run.workspace).map(([path, c]) => ({ path, bytes: c.length })) };
    },
  },
  {
    name: "weather_current",
    description: "Get current weather for a city (city name in nominative form, e.g. 'Gdańsk').",
    parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"], additionalProperties: false },
    sideEffect: false,
    async execute(args) { return multitask("multitask.weather.current", { task: "weather in " + str(args, "city", 80) }); },
  },
  {
    name: "website_build",
    description: "Generate a complete self-contained HTML website from a detailed brief (sections, copy, audience, style).",
    parameters: { type: "object", properties: { brief: { type: "string" } }, required: ["brief"], additionalProperties: false },
    sideEffect: false,
    async execute(args) {
      const result = await multitask("multitask.website.build", { task: str(args, "brief", 5000) });
      const html = result.artifacts?.[0]?.content;
      if (result.status !== "EXECUTED" || !html) return result;
      // Give the model something it can verify and edit: the page lands in the workspace and the
      // tool output carries its outline, so the agent never has to rebuild the site blind.
      const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 20);
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
      return { ...result, output: { ...(result.output as object), workspacePath: "site/index.html", bytes: html.length, title, headings }, workspaceWrites: { "site/index.html": html } };
    },
  },
  {
    name: "document_create",
    description: "Create a downloadable PDF or DOCX. Put the FULL final document text in `text`.",
    parameters: { type: "object", properties: { title: { type: "string" }, text: { type: "string" }, format: { type: "string", enum: ["pdf", "docx"] } }, required: ["title", "text", "format"], additionalProperties: false },
    sideEffect: false,
    async execute(args) {
      const title = str(args, "title", 200);
      return multitask("multitask.document.create", { task: title, text: title + "\n\n" + str(args, "text", 50_000), format: args.format === "docx" ? "docx" : "pdf" });
    },
  },
  {
    name: "data_analyze",
    description: "Analyze a CSV/JSON series (first column label, numeric value column). Returns values, period-over-period deltas and a chart.",
    parameters: { type: "object", properties: { data: { type: "string" } }, required: ["data"], additionalProperties: false },
    sideEffect: false,
    async execute(args) {
      const data = str(args, "data", 50_000);
      const series = parseSeries(data);
      const deltas = series.slice(1).map((p, i) => ({ from: series[i].label, to: p.label, delta: p.value - series[i].value }));
      const chart = await multitask("multitask.data.analyze", { task: "data", text: data });
      const largestDrop = deltas.length ? deltas.reduce((a, b) => (b.delta < a.delta ? b : a)) : null;
      return { ...chart, output: { series, deltas, largestDrop, chart: chart.status } };
    },
  },
  {
    name: "send_email",
    description: "Send an email to a recipient. This is an external side effect and always requires human approval.",
    parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"], additionalProperties: false },
    sideEffect: true,
    async execute() {
      // No email integration exists yet. Report it honestly instead of pretending the email was sent.
      return { status: "FAILED", output: { error: "EMAIL_INTEGRATION_NOT_CONFIGURED", sent: false } };
    },
  },
];

/** Built-in tools plus optional ones enabled by environment (e.g. run_command when AGENT_SANDBOX=local). */
export function defaultTools(): AgentTool[] {
  const sandbox = sandboxToolFromEnv();
  return sandbox ? [...builtinTools, sandbox] : builtinTools;
}

export const FINISH_TOOL = {
  name: "finish",
  description: "Call ONLY when the goal is fully achieved. Report every acceptance criterion with concrete evidence (file paths, artifact names, values).",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string" },
      criteria: { type: "array", items: { type: "object", properties: { criterion: { type: "string" }, met: { type: "boolean" }, evidence: { type: "string" } }, required: ["criterion", "met", "evidence"] } },
    },
    required: ["summary", "criteria"],
    additionalProperties: false,
  },
} as const;
