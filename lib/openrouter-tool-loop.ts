import { executeRoutedMultiTask, type MultiTaskArtifact } from "@/lib/multitask-engine";
import { routeIntelligenceTask } from "@/lib/m12-intelligence-router";

export type NativeToolExecution = {
  toolId: string;
  status: "EXECUTED" | "FAILED";
  receipt: unknown;
  artifact?: MultiTaskArtifact;
  steps: number;
};

type ToolCall = { id?: string; type?: string; function?: { name?: string; arguments?: string } };

const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "multitask_weather_current",
      description: "Fetch current live weather for a requested city.",
      parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "multitask_data_analyze",
      description: "Analyze CSV, JSON or tabular data and produce a verified data artifact.",
      parameters: { type: "object", properties: { task: { type: "string" }, text: { type: "string" } }, required: ["task"], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "multitask_website_build",
      description: "Build the actual self-contained responsive website artifact requested by the user.",
      parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "multitask_document_create",
      description: "Create an actual PDF or DOCX artifact.",
      parameters: { type: "object", properties: { task: { type: "string" }, text: { type: "string" }, format: { type: "string", enum: ["pdf", "docx"] } }, required: ["task"], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "multitask_image_edit",
      description: "Edit the supplied image according to the user's instruction.",
      parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "multitask_image_combine",
      description: "Semantically combine supplied reference images into one image artifact.",
      parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"], additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "multitask_video_prepare",
      description: "Prepare an image-to-video artifact using the configured video provider.",
      parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"], additionalProperties: false }
    }
  }
];

function nameToAction(name: string) {
  return name.replace(/^multitask_/, "multitask.").replace(/_/g, ".");
}

function toolSystemPrompt() {
  return [
    "You are Core Engine AI's operational tool controller.",
    "Use a tool when the user's request requires a concrete artifact or live data.",
    "After the tool returns, answer the user using only the returned execution evidence.",
    "Never claim a tool executed if the tool result says FAILED.",
    "Do not expose internal JSON or tool protocol details.",
    "External side effects remain blocked behind Core Engine approval controls."
  ].join("\n");
}

export async function runOpenRouterToolLoop(input: {
  task: string;
  context?: string;
  imageData?: string;
  imageDatas?: string[];
  timeoutMs?: number;
}): Promise<{ ok: boolean; text?: string; execution?: NativeToolExecution; model?: string; steps: number }> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return { ok: false, steps: 0 };

  const route = routeIntelligenceTask(input.task);
  const model = route.candidateModels[0] || process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5-mini";
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const messages: any[] = [
    { role: "system", content: toolSystemPrompt() },
    { role: "user", content: input.task + (input.context ? "\n\nCONTEXT:\n" + input.context.slice(0, 50000) : "") }
  ];
  const started = Date.now();

  for (let step = 1; step <= 4; step++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://core-engine.ai",
          "X-Title": "Core Engine AI"
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages,
          tools: TOOL_DEFS,
          tool_choice: "auto"
        }),
        signal: controller.signal
      });
      const raw = await response.text();
      if (!response.ok) throw new Error("OPENROUTER_TOOL_HTTP_" + response.status + ":" + raw.slice(0, 300));
      const body = JSON.parse(raw);
      const message = body?.choices?.[0]?.message;
      if (!message) throw new Error("OPENROUTER_TOOL_EMPTY_MESSAGE");

      const calls = Array.isArray(message.tool_calls) ? message.tool_calls as ToolCall[] : [];
      if (!calls.length) {
        const text = typeof message.content === "string" ? message.content.trim() : "";
        if (!text) throw new Error("OPENROUTER_TOOL_EMPTY_CONTENT");
        return { ok: true, text, model, steps: step };
      }

      messages.push(message);

      let lastExecution: NativeToolExecution | undefined;
      for (const call of calls.slice(0, 1)) {
        const functionName = String(call.function?.name || "");
        const actionId = nameToAction(functionName);
        const rawArgs = String(call.function?.arguments || "{}");
        let args: Record<string, unknown>;
        try { args = JSON.parse(rawArgs); } catch { args = { task: input.task }; }
        const toolInput: Record<string, unknown> = {
          ...args,
          task: typeof args.task === "string" ? args.task : input.task,
          text: typeof args.text === "string" ? args.text : input.context || "",
          imageData: input.imageData || "",
          imageDatas: input.imageDatas || []
        };
        const routed = await executeRoutedMultiTask(String(toolInput.task), toolInput);
        const receipt = routed.receipt;
        const status = receipt?.status === "EXECUTED" ? "EXECUTED" : "FAILED";
        lastExecution = { toolId: actionId, status, receipt, artifact: routed.artifact, steps: step };
        messages.push({
          role: "tool",
          tool_call_id: call.id || "tool-" + step,
          content: JSON.stringify({
            status,
            toolId: actionId,
            receipt: receipt ? {
              status: receipt.status,
              message: receipt.message,
              output: receipt.output
            } : null,
            artifact: routed.artifact ? {
              type: routed.artifact.type,
              title: routed.artifact.title,
              status: routed.artifact.status,
              provider: routed.artifact.provider,
              text: routed.artifact.text,
              filename: routed.artifact.filename,
              mimeType: routed.artifact.mimeType
            } : null
          })
        });
      }

      if (lastExecution?.status === "FAILED") {
        return {
          ok: true,
          text: "Wykonanie narzędzia nie powiodło się: " + (lastExecution.receipt as { message?: string })?.message,
          execution: lastExecution,
          model,
          steps: step
        };
      }

      if (step === 4) {
        return {
          ok: true,
          text: lastExecution?.artifact?.text || "Zadanie zostało wykonane.",
          execution: lastExecution,
          model,
          steps: step
        };
      }

      const finalProbe = messages[messages.length - 1];
      void finalProbe;
      if (lastExecution) {
        const follow = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
            "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://core-engine.ai",
            "X-Title": "Core Engine AI"
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages,
            tools: TOOL_DEFS,
            tool_choice: "none"
          }),
          signal: controller.signal
        });
        const followRaw = await follow.text();
        if (!follow.ok) throw new Error("OPENROUTER_TOOL_FOLLOWUP_HTTP_" + follow.status);
        const followBody = JSON.parse(followRaw);
        const followText = String(followBody?.choices?.[0]?.message?.content || "").trim();
        if (followText) return { ok: true, text: followText, execution: lastExecution, model, steps: step };
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, steps: 4 };
}
