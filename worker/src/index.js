const MAX_RESUME_LENGTH = 12000;
const MAX_JOB_LENGTH = 12000;
const ANALYSIS_LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const attempts = new Map();

const JOB_REQUIREMENT_RULES = [
  { label: "Vue 3", jobPattern: /Vue(?:\s*3)?/i, resumePattern: /Vue(?:\s*3)?/i },
  { label: "TypeScript", jobPattern: /TypeScript/i, resumePattern: /TypeScript/i },
  { label: "Pinia 或状态管理", jobPattern: /Pinia|状态管理/i, resumePattern: /Pinia|Vuex|状态管理|状态缓存/i },
  { label: "REST API 或接口开发", jobPattern: /REST\s*API|接口/i, resumePattern: /REST\s*API|接口|API/i },
  { label: "Node.js", jobPattern: /Node\.js/i, resumePattern: /Node\.js/i },
  { label: "MySQL", jobPattern: /MySQL/i, resumePattern: /MySQL/i },
  { label: "性能优化", jobPattern: /性能优化|加载速度|响应速度/i, resumePattern: /性能优化|加载时间|加载速度|响应时间|响应速度|渲染时间|缓存|降低到|减少约|提升.*速度/i },
  { label: "测试", jobPattern: /测试|质量保证/i, resumePattern: /测试|回归|测试用例|Postman/i },
  { label: "部署上线", jobPattern: /部署|上线|维护项目/i, resumePattern: /部署|上线|GitHub Pages|Render|Vercel|Cloudflare/i },
  { label: "团队协作", jobPattern: /协作|沟通|产品经理|设计师|后端工程师/i, resumePattern: /协作|沟通|与.*工程师|产品经理|设计师|后端工程师|接口联调/i }
];

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "https://230893812-a11y.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean));
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || allowedOrigins(env).has(origin);
}

function securityHeaders(request, env) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return headers;
}

function jsonResponse(request, env, status, data, extraHeaders = {}) {
  const headers = { ...securityHeaders(request, env), ...extraHeaders };
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

function errorResponse(request, env, status, code, message, extraHeaders = {}) {
  return jsonResponse(request, env, status, {
    ok: false,
    error: { code, message }
  }, extraHeaders);
}

function validateRequest(body) {
  if (!body || typeof body !== "object") return ["INVALID_JSON", "请求内容不是有效的 JSON。"];
  if (!["general", "targeted"].includes(body.mode)) return ["INVALID_MODE", "分析模式必须是 general 或 targeted。"];
  if (body.engine !== undefined && !["rules", "deepseek"].includes(body.engine)) {
    return ["INVALID_ENGINE", "Worker 分析引擎必须是 rules 或 deepseek。"];
  }
  if (typeof body.resume_text !== "string" || body.resume_text.trim() === "") return ["RESUME_REQUIRED", "请先提供简历文本。"];
  if (body.resume_text.length > MAX_RESUME_LENGTH) return ["RESUME_TOO_LONG", "简历文本不能超过 12,000 字。"];
  const jobText = typeof body.job_text === "string" ? body.job_text : "";
  if (body.mode === "targeted" && jobText.trim() === "") return ["JOB_REQUIRED", "目标岗位模式需要提供岗位 JD。"];
  if (jobText.length > MAX_JOB_LENGTH) return ["JOB_TOO_LONG", "岗位 JD 不能超过 12,000 字。"];
  return null;
}

function addIssue(issues, category, title, description, follow_up, priority = 2) {
  issues.push({ priority, category, title, description, follow_up });
}

function buildRuleResult(body) {
  const resume = body.resume_text;
  const job = typeof body.job_text === "string" ? body.job_text : "";
  const issues = [];
  const evidence = [];
  const vagueMatches = resume.match(/负责|参与|协助|配合|熟悉|了解/g) || [];
  const resultMatches = resume.match(/\d+(?:\.\d+)?\s*(?:%|秒|毫秒|人|个|条|次|万元|万)/g) || [];
  const contributionMatches = resume.match(/独立|本人|我负责|我完成|主导|设计并实现/g) || [];
  const technologyMatches = resume.match(/JavaScript|TypeScript|Vue(?:\s*3)?|React|Node\.js|Express|MySQL|Python|Java|Git|Postman/gi) || [];

  if (vagueMatches.length >= 3) {
    addIssue(issues, "表达清晰度", "模糊动词较多，个人动作不够具体", `检测到“负责、参与、协助”等模糊表达约 ${vagueMatches.length} 处。它们不能单独证明你具体完成了什么。`, "请把其中一条改成具体动作、交付物和你本人负责的范围。", 1);
  } else if (vagueMatches.length > 0) {
    evidence.push(`检测到少量模糊动词：${[...new Set(vagueMatches)].join("、")}`);
  }
  if (resultMatches.length === 0) {
    addIssue(issues, "成果证据", "暂时没有检测到可验证的成果指标", "简历中出现了工作或项目描述，但没有发现时间、数量、性能或交付结果等量化证据。", "是否可以补充项目规模、交付物、测试数量、时间变化或其他真实结果？", 1);
  } else {
    evidence.push(`检测到 ${resultMatches.length} 处可能的量化证据`);
  }
  if (contributionMatches.length === 0) {
    addIssue(issues, "个人贡献", "个人贡献边界不够清晰", "当前文本没有明显区分团队成果和你本人负责或参与的具体工作。", "你具体负责或参与了哪些模块、接口、测试或交付工作？", 1);
  } else {
    evidence.push("检测到个人贡献描述");
  }
  if (technologyMatches.length === 0) {
    addIssue(issues, "项目上下文", "没有检测到明确技术栈", "简历中的项目描述暂时没有和具体技术、工具或开发场景建立联系。", "请说明你在项目中实际使用了哪些技术，以及用它们解决了什么问题。", 2);
  } else {
    evidence.push(`检测到技术或工具：${[...new Set(technologyMatches)].slice(0, 8).join("、")}`);
  }
  if (body.mode === "targeted") {
    const detected = JOB_REQUIREMENT_RULES.filter((rule) => rule.jobPattern.test(job));
    const covered = detected.filter((rule) => rule.resumePattern.test(resume));
    const missing = detected.filter((rule) => !rule.resumePattern.test(resume));
    if (covered.length) evidence.push(`检测到岗位要求对应证据：${covered.map((rule) => rule.label).join("、")}`);
    if (missing.length) {
      addIssue(issues, "岗位要求覆盖", "部分岗位要求没有在简历中找到直接证据", `JD 中检测到但简历暂未出现明确证据的要求包括：${missing.slice(0, 6).map((rule) => rule.label).join("、")}。这只表示当前简历缺少证据，不代表你没有这些能力。`, "请确认这些要求是否对应某段真实经历；如果有，请补充项目场景和个人贡献。", 1);
    }
  }
  return {
    ok: true,
    mode: body.mode,
    analysis_type: "rules",
    summary: body.mode === "targeted" ? "规则检查完成：先处理最影响岗位匹配度的证据缺口。" : "规则检查完成：先处理最影响简历可信度的证据缺口。",
    evidence_found: evidence,
    issues: issues.sort((a, b) => a.priority - b.priority).slice(0, 5),
    next_step: "这是确定性规则检查，不调用大模型，也不会补写简历中没有的数字或职责。"
  };
}

function modelInput(body, ruleResult) {
  return {
    task: body.mode === "targeted" ? "检查简历对目标岗位要求的证据覆盖情况" : "检查简历本身的表达和证据完整性",
    mode: body.mode,
    resume_text: body.resume_text,
    job_text: body.mode === "targeted" ? body.job_text : "",
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
      evidence_gaps: [{ category: "string", claim: "string", explanation: "string", severity: "blocking | enhancement", related_evidence: "string" }],
      follow_up_questions: "string[]",
      rewrite_readiness: "needs_facts | ready_for_limited_rewrite",
      safety_note: "string"
    }
  };
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function normalizeQuestion(question) {
  return typeof question === "string"
    ? question.replace(/独立|独自/g, "负责或参与").trim()
    : "";
}

function normalizeOutput(output) {
  const item = output && typeof output === "object" ? output : {};
  const gaps = Array.isArray(item.evidence_gaps) ? item.evidence_gaps.map((gap) => ({
    category: firstText(gap?.category, gap?.requirement, "证据缺口"),
    claim: firstText(gap?.claim, gap?.gap, gap?.description, "需要补充事实"),
    explanation: firstText(gap?.explanation, gap?.detail, gap?.description, gap?.note, "当前证据不足"),
    severity: ["blocking", "enhancement"].includes(gap?.severity) ? gap.severity : "blocking",
    related_evidence: firstText(gap?.related_evidence, gap?.evidence, gap?.source)
  })) : [];
  return {
    summary: firstText(item.summary),
    evidence_found: Array.isArray(item.evidence_found) ? item.evidence_found.filter((value) => typeof value === "string" && value.trim()) : [],
    evidence_gaps: gaps,
    follow_up_questions: Array.isArray(item.follow_up_questions) ? item.follow_up_questions.map(normalizeQuestion).filter(Boolean) : [],
    rewrite_readiness: gaps.length ? "needs_facts" : item.rewrite_readiness,
    safety_note: firstText(item.safety_note)
  };
}

function validateModelOutput(output) {
  if (!output.summary || !Array.isArray(output.evidence_found) || !Array.isArray(output.evidence_gaps) || !Array.isArray(output.follow_up_questions)) return "模型输出字段不完整。";
  if (output.evidence_gaps.some((gap) => !gap.category || !gap.claim || !gap.explanation || !["blocking", "enhancement"].includes(gap.severity) || typeof gap.related_evidence !== "string")) return "模型输出包含无效的 evidence_gaps 项。";
  if (!["needs_facts", "ready_for_limited_rewrite"].includes(output.rewrite_readiness)) return "模型输出包含无效的 rewrite_readiness。";
  if (!output.safety_note) return "模型输出缺少 safety_note。";
  return null;
}

async function callDeepSeek(body, env, ruleResult) {
  if (!env.DEEPSEEK_API_KEY) throw Object.assign(new Error("未配置 DEEPSEEK_API_KEY。请先在 Worker Secrets 中设置。"), { code: "DEEPSEEK_KEY_MISSING" });
  const endpoint = String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const systemPrompt = [
    "你是一个证据优先的简历审阅助手。",
    "只能根据用户提供的简历和岗位 JD 判断证据，不评价人的价值。",
    "禁止编造数字、职责、用户规模、公司名称、上线结果或任何简历中没有的事实。",
    "简历没有写某项能力时，只能说当前缺少证据，不能断言用户没有这项能力。",
    "事实不足时提出追问，不要直接替用户补写事实。",
    "不得诱导用户把协作成果包装成独立完成、独立负责、独立设计、独立实现、独立开发或独自主导。",
    "只返回合法 JSON，不要返回 Markdown。JSON 必须包含 summary、evidence_found、evidence_gaps、follow_up_questions、rewrite_readiness、safety_note。",
    "evidence_gaps 每项只能使用 category、claim、explanation、severity、related_evidence；severity 只能是 blocking 或 enhancement。"
  ].join("\n");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: JSON.stringify(modelInput(body, ruleResult)) }]
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("DeepSeek 上游请求超过 25 秒未响应，请稍后重试。"), { code: "DEEPSEEK_TIMEOUT" });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw Object.assign(new Error("DeepSeek 返回了无法解析的响应。"), { code: "DEEPSEEK_INVALID_RESPONSE" }); }
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || `DeepSeek 请求失败（HTTP ${response.status}）。`), { code: "DEEPSEEK_REQUEST_FAILED" });
  const content = payload.choices?.[0]?.message?.content;
  const clean = String(content || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  let output;
  try { output = normalizeOutput(JSON.parse(clean)); } catch { throw Object.assign(new Error("DeepSeek 返回的内容不是有效 JSON。"), { code: "DEEPSEEK_INVALID_RESPONSE" }); }
  const validationError = validateModelOutput(output);
  if (validationError) throw Object.assign(new Error(validationError), { code: "INVALID_MODEL_OUTPUT" });
  return { provider: "deepseek", model: env.DEEPSEEK_MODEL || "deepseek-chat", is_real_ai: true, ...output };
}

async function clientHash(request) {
  const raw = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeAttempt(request) {
  const now = Date.now();
  for (const [key, record] of attempts) if (now >= record.resetAt) attempts.delete(key);
  const key = await clientHash(request);
  let record = attempts.get(key);
  if (!record) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    attempts.set(key, record);
  }
  if (record.count >= ANALYSIS_LIMIT) return { allowed: false, remaining: 0, resetAt: record.resetAt };
  record.count += 1;
  return { allowed: true, remaining: ANALYSIS_LIMIT - record.count, resetAt: record.resetAt };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (request.method === "OPTIONS" && (pathname === "/api/analyze" || pathname === "/health")) {
      if (!isAllowedOrigin(request, env)) return errorResponse(request, env, 403, "ORIGIN_NOT_ALLOWED", "当前网页来源无权调用此接口。");
      return new Response(null, { status: 204, headers: securityHeaders(request, env) });
    }
    if (request.method === "GET" && pathname === "/health") {
      return jsonResponse(request, env, 200, { ok: true, service: "resume-evidence-audit-worker" });
    }
    if (pathname !== "/api/analyze" || request.method !== "POST") return errorResponse(request, env, 404, "NOT_FOUND", "找不到这个接口。");
    if (!isAllowedOrigin(request, env)) return errorResponse(request, env, 403, "ORIGIN_NOT_ALLOWED", "当前网页来源无权调用此接口。");
    let body;
    try { body = await request.json(); } catch { return errorResponse(request, env, 400, "INVALID_JSON", "请求内容不是有效的 JSON。"); }
    const validationError = validateRequest(body);
    if (validationError) return errorResponse(request, env, 400, validationError[0], validationError[1]);
    const rate = await consumeAttempt(request);
    const rateHeaders = {
      "X-RateLimit-Limit": String(ANALYSIS_LIMIT),
      "X-RateLimit-Remaining": String(rate.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000))
    };
    if (!rate.allowed) return errorResponse(request, env, 429, "RATE_LIMIT_EXCEEDED", "同一网络来源每 24 小时最多发起 3 次有效分析，请在限制重置后重试。", { ...rateHeaders, "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) });
    const rules = buildRuleResult(body);
    if ((body.engine || "rules") === "rules") return jsonResponse(request, env, 200, rules, rateHeaders);
    try {
      const model = await callDeepSeek(body, env, rules);
      return jsonResponse(request, env, 200, { ok: true, mode: body.mode, analysis_type: "hybrid-deepseek", rule_analysis: rules, model_analysis: model }, rateHeaders);
    } catch (error) {
      return errorResponse(request, env, error.code === "DEEPSEEK_KEY_MISSING" ? 500 : 502, error.code || "ANALYSIS_FAILED", error.message || "分析流程失败，请稍后重试。", rateHeaders);
    }
  }
};
