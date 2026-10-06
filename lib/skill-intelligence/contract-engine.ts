import type {ContractValidation, SkillContract} from "./contracts";

const risks = new Set(["LOW","MEDIUM","HIGH","CRITICAL"]);
const capabilities = new Set(["OBSERVE","TRANSFORM","WRITE","EXECUTE","EXTERNAL","PUBLISH"]);

export function validateSkillContract(contract: SkillContract): ContractValidation {
  const errors: string[] = [];
  if (!contract.id.trim()) errors.push("SKILL_ID_REQUIRED");
  if (!contract.version.trim()) errors.push("SKILL_VERSION_REQUIRED");
  if (!contract.name.trim()) errors.push("SKILL_NAME_REQUIRED");
  if (!contract.description.trim()) errors.push("SKILL_DESCRIPTION_REQUIRED");
  if (!contract.domains.length) errors.push("SKILL_DOMAIN_REQUIRED");
  if (!risks.has(contract.risk)) errors.push("SKILL_RISK_INVALID");
  for (const capability of contract.capabilities) if (!capabilities.has(capability)) errors.push("SKILL_CAPABILITY_INVALID:"+capability);
  if (contract.risk === "HIGH" || contract.risk === "CRITICAL") {
    if (!contract.preconditions.length) errors.push("HIGH_RISK_PRECONDITIONS_REQUIRED");
    if (!contract.postconditions.length) errors.push("HIGH_RISK_POSTCONDITIONS_REQUIRED");
  }
  const required = new Set(contract.inputSchema.required);
  for (const key of required) if (!contract.inputSchema.properties[key]) errors.push("INPUT_REQUIRED_PROPERTY_MISSING:"+key);
  return {valid: errors.length === 0, errors};
}

export function assertSkillContract(contract: SkillContract): SkillContract {
  const result = validateSkillContract(contract);
  if (!result.valid) throw new Error(result.errors.join(","));
  return contract;
}
