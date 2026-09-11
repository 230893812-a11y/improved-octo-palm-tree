const ALLOWED_MODES = new Set(["general", "targeted"]);

function buildModelInput({ mode, resumeText, jobText, ruleResult }) {
  if (!ALLOWED_MODES.has(mode)) {
    throw new Error("模型输入包含无效分析模式。");
  }

  return {
    task: mode === "targeted"
      ? "检查简历对目标岗位要求的证据覆盖情况"
      : "检查简历本身的表达和证据完整性",
    mode,
    resume_text: resumeText,
    job_text: mode === "targeted" ? jobText : "",
    rule_evidence: ruleResult.evidence_found,
    rule_issues: ruleResult.issues,
    fact_boundaries: [
      "只能使用简历和岗位 JD 中明确提供的事实。",
      "不得编造数字、职责、用户规模、公司名称或上线结果。",
      "简历没有写某项能力，只能表述为缺少证据，不能断言用户没有能力。",
      "如需改写前缺少事实，应先提出追问。"
    ],
    required_output: {
      summary: "string",
      evidence_found: "string[]",
      evidence_gaps: "object[]",
      follow_up_questions: "string[]",
      rewrite_readiness: "needs_facts | ready_for_limited_rewrite",
      safety_note: "string"
    }
  };
}

function runMockModel(modelInput) {
  const evidenceGaps = modelInput.rule_issues.map((issue) => ({
    category: issue.category,
    claim: issue.title,
    explanation: issue.description,
    source: "rule_analysis"
  }));

  const followUpQuestions = modelInput.rule_issues
    .map((issue) => issue.follow_up)
    .filter(Boolean);

  const hasGaps = evidenceGaps.length > 0;

  return {
    provider: "mock",
    model: "local-structured-mock",
    is_real_ai: false,
    summary: hasGaps
      ? `模拟模型收到 ${evidenceGaps.length} 个规则证据缺口，需要用户先补充真实事实。`
      : "模拟模型没有收到高优先级规则缺口，可以进入有限改写准备阶段。",
    evidence_found: modelInput.rule_evidence,
    evidence_gaps: evidenceGaps,
    follow_up_questions: followUpQuestions,
    rewrite_readiness: hasGaps
      ? "needs_facts"
      : "ready_for_limited_rewrite",
    safety_note: "这是本地模拟模型结果，没有调用外部大模型，也没有生成简历中不存在的事实。"
  };
}

function validateModelOutput(output) {
  if (!output || typeof output !== "object") {
    return "模型输出不是对象。";
  }

  if (typeof output.summary !== "string" || output.summary.trim() === "") {
    return "模型输出缺少 summary。";
  }

  if (!Array.isArray(output.evidence_found)) {
    return "模型输出的 evidence_found 必须是数组。";
  }

  if (!Array.isArray(output.evidence_gaps)) {
    return "模型输出的 evidence_gaps 必须是数组。";
  }

  if (!Array.isArray(output.follow_up_questions)) {
    return "模型输出的 follow_up_questions 必须是数组。";
  }

  if (!["needs_facts", "ready_for_limited_rewrite"].includes(output.rewrite_readiness)) {
    return "模型输出包含无效的 rewrite_readiness。";
  }

  if (typeof output.safety_note !== "string" || output.safety_note.trim() === "") {
    return "模型输出缺少 safety_note。";
  }

  return null;
}

module.exports = {
  buildModelInput,
  runMockModel,
  validateModelOutput
};
