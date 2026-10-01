import { coreTools, getTool, registerTool } from "./tool-registry";

let initialized = false;

export function initializeCoreTools(): void {
  // Self-heal after test/runtime consumers clear the registry. The registry
  // contents, not this module flag, are the source of truth.
  if (initialized && getTool("tool-registry")) return;
  for (const tool of coreTools) {
    try {
      registerTool(tool);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("TOOL_ALREADY_REGISTERED:")) throw error;
    }
  }
  initialized = true;
}

export function getCoreTools() {
  initializeCoreTools();
  return coreTools;
}
