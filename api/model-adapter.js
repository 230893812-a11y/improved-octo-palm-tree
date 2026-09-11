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
      evidence_gaps: [{
        category: "string",
        claim: "string",
        explanation: "string",
        severity: "blocking | enhancement",
        related_evidence: "string"
      }],
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
    severity: "blocking",
    related_evidence: "规则分析未定位到完整原文"
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

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim() || "";
}

function normalizeGap(gap) {
  const item = gap && typeof gap === "object" ? gap : {};
  const category = firstText(item.category, item.requirement, "证据缺口");
  const claim = firstText(item.claim, item.gap, item.description, item.note, item.status, "需要补充事实");
  const explanation = firstText(
    item.explanation,
    item.detail,
    item.description,
    item.note,
    item.impact,
    item.status,
    claim
  );

  return {
    category,
    claim,
    explanation,
    severity: ["blocking", "enhancement"].includes(item.severity)
      ? item.severity
      : "blocking",
    related_evidence: firstText(item.related_evidence, item.evidence, item.source)
  };
}

function normalizeQuestion(question) {
  if (typeof question !== "string") {
    return "";
  }

  return question
    .replace(/具体独立完成了哪些/g, "具体负责或参与了哪些")
    .replace(/独立完成了哪些/g, "负责或参与了哪些")
    .replace(/独立完成/g, "负责或参与")
    .trim();
}

function normalizeModelOutput(output) {
  const item = output && typeof output === "object" ? output : {};

  return {
    summary: firstText(item.summary),
    evidence_found: Array.isArray(item.evidence_found)
      ? item.evidence_found.filter((evidence) => typeof evidence === "string" && evidence.trim() !== "")
      : [],
    evidence_gaps: Array.isArray(item.evidence_gaps)
      ? item.evidence_gaps.map(normalizeGap)
      : [],
    follow_up_questions: Array.isArray(item.follow_up_questions)
      ? item.follow_up_questions.map(normalizeQuestion).filter(Boolean)
      : [],
    rewrite_readiness: item.rewrite_readiness,
    safety_note: firstText(item.safety_note)
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

  const invalidGap = output.evidence_gaps.find((gap) => {
    return !gap
      || typeof gap.category !== "string"
      || typeof gap.claim !== "string"
      || typeof gap.explanation !== "string"
      || !["blocking", "enhancement"].includes(gap.severity)
      || typeof gap.related_evidence !== "string";
  });

  if (invalidGap) {
    return "模型输出包含无效的 evidence_gaps 项。";
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

function enforceFactBoundary(output) {
  if (output.evidence_gaps.length > 0) {
    output.rewrite_readiness = "needs_facts";
    output.safety_note = `${output.safety_note} 后端安全规则：存在证据缺口，必须先补充事实，暂不进入改写。`;
  }

  return output;
}

function extractJsonObject(content) {
  if (typeof content !== "string") {
    throw new Error("DeepSeek 返回内容不是文本。");
  }

  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    throw new Error("DeepSeek 返回的内容不是有效 JSON。");
  }
}

async function callDeepSeek(modelInput) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const endpoint = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!apiKey) {
    const error = new Error("未配置 DEEPSEEK_API_KEY。请先设置后端环境变量。");
    error.code = "DEEPSEEK_KEY_MISSING";
    throw error;
  }

  const systemPrompt = [
    "你是一个证据优先的简历审阅助手。",
    "你只能根据用户提供的简历和岗位 JD 判断证据，不评价人的价值。",
    "严格禁止编造数字、职责、用户规模、公司名称、上线结果或任何简历中没有的事实。",
    "简历没有写某项能力时，只能说当前缺少证据，不能断言用户没有这项能力。",
    "如果事实不足，提出追问，不要直接替用户补写事实。",
    "必须区分团队成果与个人动作，但不得把独立完成当作唯一合格贡献；协作、测试、联调、发现并反馈问题都可以是有效个人贡献。",
    "如果简历已经用我的工作、我主要参与、我负责等方式明确列出个人动作，不得再笼统判断为完全没有区分个人贡献；只能指出其中仍不清楚的具体范围或产出。",
    "不得诱导用户把协作成果包装成独立完成。追问应询问具体负责步骤、交付物和验证结果，而不是默认要求独立完成。",
    "必须保持动作归属准确：发现并反馈问题不等于修复问题，参与联调不等于开发接口，协助测试不等于主导测试。",
    "只返回合法 JSON，不要返回 Markdown，不要添加 JSON 以外的解释。",
    "JSON 必须包含 summary、evidence_found、evidence_gaps、follow_up_questions、rewrite_readiness、safety_note。",
    "evidence_gaps 中每一项必须且只能使用 category、claim、explanation、severity、related_evidence 字段。severity 只能是 blocking 或 enhancement。",
    "blocking 表示缺少关键事实、事实归属或真实性依据，暂不应改写；enhancement 表示已有基本事实，只是可继续补充细节。",
    "rewrite_readiness 只能是 needs_facts 或 ready_for_limited_rewrite。"
  ].join("\n");

  const response = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(modelInput, null, 2)
        }
      ]
    }, null, 2)
  });

  const responseText = await response.text();
  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch {
    const error = new Error("DeepSeek 返回了无法解析的响应。");
    error.code = "DEEPSEEK_INVALID_RESPONSE";
    throw error;
  }

  if (!response.ok) {
    const error = new Error(payload.error?.message || `DeepSeek 请求失败（HTTP ${response.status}）。`);
    error.code = "DEEPSEEK_REQUEST_FAILED";
    throw error;
  }

  const content = payload.choices?.[0]?.message?.content;
  const output = normalizeModelOutput(extractJsonObject(content));
  const validationError = validateModelOutput(output);

  if (validationError) {
    const error = new Error(validationError);
    error.code = "INVALID_MODEL_OUTPUT";
    throw error;
  }

  return enforceFactBoundary({
    provider: "deepseek",
    model,
    is_real_ai: true,
    ...output
  });
}

module.exports = {
  buildModelInput,
  callDeepSeek,
  runMockModel,
  validateModelOutput
};
