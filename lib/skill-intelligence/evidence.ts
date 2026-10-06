export type SkillEvidence={id:string;skillId:string;claim:string;provenance:Record<string,unknown>;fingerprint:string;createdAt:string};

function fingerprint(value:string):string {
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,"0");
}

export function generateSkillEvidence(input:{skillId:string;claim:string;provenance:Record<string,unknown>;createdAt?:string}):SkillEvidence {
  const createdAt=input.createdAt??new Date().toISOString();
  const canonical=JSON.stringify({skillId:input.skillId,claim:input.claim,provenance:input.provenance,createdAt});
  return {id:fingerprint(canonical),skillId:input.skillId,claim:input.claim,provenance:input.provenance,fingerprint:fingerprint(canonical),createdAt};
}
