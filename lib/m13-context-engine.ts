export type ContextEnvelope = {
  version: "M13";
  task: string;
  context: string;
  tokenBudgetChars: number;
  originalChars: number;
  truncated: boolean;
  sections: string[];
};

function clean(value: string, max: number) {
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

export function buildContextEnvelope(task: string, context = "", maxChars = 45000): ContextEnvelope {
  const safeTask = clean(task, 12000);
  const safeContext = clean(context, Math.max(0, maxChars - safeTask.length - 64));
  const sections = ["task"];
  if (safeContext) sections.push("context");
  return {
    version: "M13",
    task: safeTask,
    context: safeContext,
    tokenBudgetChars: maxChars,
    originalChars: context.length,
    truncated: context.length > safeContext.length,
    sections
  };
}

export function serializeContextEnvelope(envelope: ContextEnvelope) {
  return [
    "CORE ENGINE CONTEXT M13",
    "TASK:",
    envelope.task,
    envelope.context ? "CONTEXT:" : "",
    envelope.context
  ].filter(Boolean).join("\n");
}

export function contextReadiness() {
  return {
    status: "READY",
    version: "M13",
    bounded: true,
    credentialMaterialExposed: false,
    maxContextChars: 45000
  };
}
