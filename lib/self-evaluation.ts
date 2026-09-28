export type SelfEvaluationInput={goalAchieved:boolean;evidenceVerified:boolean;decisionCalibrated:boolean;executionVerified:boolean;learningExtracted:boolean;failureRecovered:boolean};

export function evaluateTrajectory(input:SelfEvaluationInput){
  const dimensions=[
    ["goal",input.goalAchieved],
    ["evidence",input.evidenceVerified],
    ["decision",input.decisionCalibrated],
    ["execution",input.executionVerified],
    ["learning",input.learningExtracted],
    ["recovery",input.failureRecovered]
  ] as const;
  const passed=dimensions.filter(([,ok])=>ok).length;
  const score=passed/dimensions.length;
  const gaps=dimensions.filter(([,ok])=>!ok).map(([name])=>name);
  const status=score>=.9?"HIGH_QUALITY":score>=.7?"ACCEPTABLE":"NEEDS_REVIEW";
  return {score,status,gaps,dimensions:Object.fromEntries(dimensions)};
}

export function improvementSignals(input:ReturnType<typeof evaluateTrajectory>){
  return input.gaps.map(g=>({
    dimension:g,
    action:g==="evidence"?"increase independent evidence before decision":
      g==="decision"?"recalibrate decision confidence against outcomes":
      g==="execution"?"verify destination state, not only tool success":
      g==="learning"?"extract a reusable lesson and provenance":
      g==="recovery"?"record failure and recovery pattern":
      "revisit problem definition and goal"
  }));
}
