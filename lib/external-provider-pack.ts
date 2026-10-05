import { registerCapabilityPack } from "@/lib/capability-registry";

registerCapabilityPack({
  id: "core.external-providers.v1",
  name: "External Build Providers",
  version: "1.0.0",
  category: "INTEGRATION",
  inspiredBy: ["GitHub", "Vercel"],
  description: "Governed execution adapters for repository creation, source commits and Vercel deployments.",
  capabilities: ["github-repository", "github-commit", "vercel-deploy"],
  actions: [
    {
      id: "github.repository.create",
      name: "Create GitHub repository",
      description: "Create and initialize a GitHub repository with approved source files.",
      risk: "HIGH",
      requiresApproval: true,
      inputs: ["name", "description", "private", "files"],
      outputs: ["repository", "url", "commitSha"]
    },
    {
      id: "github.repository.commit",
      name: "Commit source to GitHub",
      description: "Create or update an approved source file in a GitHub repository.",
      risk: "HIGH",
      requiresApproval: true,
      inputs: ["repository", "branch", "path", "content", "message"],
      outputs: ["commitSha"]
    },
    {
      id: "vercel.project.deploy",
      name: "Deploy GitHub project to Vercel",
      description: "Create or reuse a Vercel project and request a deployment from a GitHub branch.",
      risk: "CRITICAL",
      requiresApproval: true,
      inputs: ["repository", "name", "branch", "framework", "target"],
      outputs: ["projectId", "deploymentId", "deploymentUrl", "state"]
    }
  ],
  signals: ["BUILD", "DEPLOY", "GITHUB", "VERCEL", "WEBSITE", "APP"],
  diagnostics: ["provider-readiness", "deployment-state", "repository-integrity"],
  metrics: ["repository-created", "commit-created", "deployment-requested"]
});

export function ensureExternalProviderPack() {
  return true;
}
