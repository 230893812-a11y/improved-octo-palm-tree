const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  buildModelInput,
  callDeepSeek,
  runMockModel,
  validateModelOutput
} = require("./model-adapter");

const PORT = Number(process.env.PORT) || 3000;
const MAX_RESUME_LENGTH = 12000;
const MAX_JOB_LENGTH = 12000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TEXT_PREVIEW_LENGTH = 200;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOCAL_PAGE_FILES = new Map([
  ["/resume-audit/", { file: "resume-audit/index.html", type: "text/html; charset=utf-8" }],
  ["/resume-audit/app.js", { file: "resume-audit/app.js", type: "application/javascript; charset=utf-8" }],
  ["/resume-audit/style.css", { file: "resume-audit/style.css", type: "text/css; charset=utf-8" }]
]);

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-File-Name"
  });

  response.end(JSON.stringify(data, null, 2));
}

function sendError(response, statusCode, code, message) {
  sendJson(response, statusCode, {
    ok: false,
    error: {
      code,
      message
    }
  });
}

function validateRequest(body) {
  if (!body || typeof body !== "object") {
    return {
      code: "INVALID_JSON",
      message: "请求内容不是有效的 JSON。"
    };
  }

  if (body.mode !== "general" && body.mode !== "targeted") {
    return {
      code: "INVALID_MODE",
      message: "分析模式必须是 general 或 targeted。"
    };
  }

  if (
    body.engine !== undefined
    && body.engine !== "rules"
    && body.engine !== "hybrid-mock"
    && body.engine !== "deepseek"
  ) {
    return {
      code: "INVALID_ENGINE",
      message: "分析引擎必须是 rules、hybrid-mock 或 deepseek。"
    };
  }

  if (typeof body.resume_text !== "string" || body.resume_text.trim() === "") {
    return {
      code: "RESUME_REQUIRED",
      message: "请先提供简历文本。"
    };
  }

  if (body.resume_text.length > MAX_RESUME_LENGTH) {
    return {
      code: "RESUME_TOO_LONG",
      message: "简历文本不能超过 12,000 字。"
    };
  }

  const jobText = typeof body.job_text === "string"
    ? body.job_text
    : "";

  if (body.mode === "targeted" && jobText.trim() === "") {
    return {
      code: "JOB_REQUIRED",
      message: "目标岗位模式需要提供岗位 JD。"
    };
  }

  if (jobText.length > MAX_JOB_LENGTH) {
    return {
      code: "JOB_TOO_LONG",
      message: "岗位 JD 不能超过 12,000 字。"
    };
  }

  return null;
}

function addIssue(issues, issue) {
  issues.push({
    priority: issue.priority || 2,
    category: issue.category,
    title: issue.title,
    description: issue.description,
    follow_up: issue.follow_up
  });
}

function serveLocalPage(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;

  if (pathname === "/resume-audit") {
    response.writeHead(302, {
      Location: "/resume-audit/",
      "Cache-Control": "no-store"
    });
    response.end();
    return true;
  }

  const asset = LOCAL_PAGE_FILES.get(pathname);

  if (!asset) {
    return false;
  }

  const absolutePath = path.join(PROJECT_ROOT, asset.file);

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      sendError(response, 500, "LOCAL_PAGE_FAILED", "本地测试页面读取失败。");
      return;
    }

    response.writeHead(200, {
      "Content-Type": asset.type,
      "Cache-Control": "no-store"
    });
    response.end(content);
  });

  return true;
}

function handleTextFileExtraction(request, response) {
  const contentType = String(request.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const rawFileName = String(request.headers["x-file-name"] || "").trim();
  let fileName = rawFileName;

  try {
    fileName = decodeURIComponent(rawFileName);
  } catch {
    sendError(response, 400, "INVALID_FILE_NAME", "文件名格式无效。");
    request.resume();
    return;
  }

  if (contentType !== "text/plain" || !fileName.toLowerCase().endsWith(".txt")) {
    sendError(response, 415, "UNSUPPORTED_FILE_TYPE", "第 8A 阶段只支持 TXT 文件。");
    request.resume();
    return;
  }

  const chunks = [];
  let receivedBytes = 0;
  let tooLarge = false;

  request.on("data", (chunk) => {
    receivedBytes += chunk.length;

    if (receivedBytes > MAX_FILE_SIZE) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }

    if (!tooLarge) {
      chunks.push(chunk);
    }
  });

  request.on("end", () => {
    if (tooLarge) {
      sendError(response, 413, "FILE_TOO_LARGE", "TXT 文件不能超过 5 MB。");
      return;
    }

    const fileBuffer = Buffer.concat(chunks);

    if (fileBuffer.length === 0) {
      sendError(response, 400, "FILE_EMPTY", "TXT 文件不能为空。");
      return;
    }

    let extractedText;

    try {
      extractedText = new TextDecoder("utf-8", { fatal: true })
        .decode(fileBuffer)
        .replace(/^\uFEFF/, "");
    } catch {
      sendError(response, 400, "INVALID_TEXT_ENCODING", "TXT 文件必须使用 UTF-8 编码。");
      return;
    }

    if (extractedText.trim() === "") {
      sendError(response, 400, "FILE_EMPTY", "TXT 文件没有可用文字。");
      return;
    }

    if (extractedText.length > MAX_RESUME_LENGTH) {
      sendError(response, 400, "RESUME_TOO_LONG", "TXT 内容不能超过 12,000 字。");
      return;
    }

    sendJson(response, 200, {
      ok: true,
      file_type: "text/plain",
      character_count: extractedText.length,
      text_preview: extractedText.slice(0, TEXT_PREVIEW_LENGTH),
      resume_text: extractedText,
      stored: false
    });
  });

  request.on("error", () => {
    if (!response.headersSent) {
      sendError(response, 400, "UPLOAD_FAILED", "TXT 文件上传失败。");
    }
  });
}

const JOB_REQUIREMENT_RULES = [
  {
    label: "Vue 3",
    jobPattern: /Vue(?:\s*3)?/i,
    resumePattern: /Vue(?:\s*3)?/i
  },
  {
    label: "TypeScript",
    jobPattern: /TypeScript/i,
    resumePattern: /TypeScript/i
  },
  {
    label: "Pinia 或状态管理",
    jobPattern: /Pinia|状态管理/i,
    resumePattern: /Pinia|Vuex|状态管理|状态缓存/i
  },
  {
    label: "REST API 或接口开发",
    jobPattern: /REST\s*API|接口/i,
    resumePattern: /REST\s*API|接口|API/i
  },
  {
    label: "Node.js",
    jobPattern: /Node\.js/i,
    resumePattern: /Node\.js/i
  },
  {
    label: "MySQL",
    jobPattern: /MySQL/i,
    resumePattern: /MySQL/i
  },
  {
    label: "性能优化",
    jobPattern: /性能优化|加载速度|响应速度/i,
    resumePattern: /性能优化|加载时间|加载速度|响应时间|响应速度|渲染时间|缓存|降低到|减少约|提升.*速度/i
  },
  {
    label: "测试",
    jobPattern: /测试|质量保证/i,
    resumePattern: /测试|回归|测试用例|Postman/i
  },
  {
    label: "部署上线",
    jobPattern: /部署|上线|维护项目/i,
    resumePattern: /部署|上线|GitHub Pages|Render|Vercel|Cloudflare/i
  },
  {
    label: "团队协作",
    jobPattern: /协作|沟通|产品经理|设计师|后端工程师/i,
    resumePattern: /协作|沟通|与.*工程师|产品经理|设计师|后端工程师|接口联调/i
  }
];

function analyzeRules(body) {
  const resume = body.resume_text;
  const job = typeof body.job_text === "string" ? body.job_text : "";
  const issues = [];
  const evidence = [];

  const vagueMatches = resume.match(/负责|参与|协助|配合|熟悉|了解/g) || [];
  const resultMatches = resume.match(/\d+(?:\.\d+)?\s*(?:%|秒|毫秒|人|个|条|次|万元|万)/g) || [];
  const contributionMatches = resume.match(/独立|本人|我负责|我完成|主导|设计并实现/g) || [];
  const technologyMatches = resume.match(/JavaScript|TypeScript|Vue(?:\s*3)?|React|Node\.js|Express|MySQL|Python|Java|Git|Postman/gi) || [];

  if (vagueMatches.length >= 3) {
    addIssue(issues, {
      priority: 1,
      category: "表达清晰度",
      title: "模糊动词较多，个人动作不够具体",
      description: `检测到“负责、参与、协助”等模糊表达约 ${vagueMatches.length} 处。它们不能单独证明你具体完成了什么。`,
      follow_up: "请把其中一条改成具体动作、交付物和你本人负责的范围。"
    });
  } else if (vagueMatches.length > 0) {
    evidence.push(`检测到少量模糊动词：${[...new Set(vagueMatches)].join("、")}`);
  }

  if (resultMatches.length === 0) {
    addIssue(issues, {
      priority: 1,
      category: "成果证据",
      title: "暂时没有检测到可验证的成果指标",
      description: "简历中出现了工作或项目描述，但没有发现时间、数量、性能或交付结果等量化证据。",
      follow_up: "是否可以补充项目规模、交付物、测试数量、时间变化或其他真实结果？"
    });
  } else {
    evidence.push(`检测到 ${resultMatches.length} 处可能的量化证据`);
  }

  if (contributionMatches.length === 0) {
    addIssue(issues, {
      priority: 1,
      category: "个人贡献",
      title: "个人贡献边界不够清晰",
      description: "当前文本没有明显区分团队成果和你本人负责或参与的具体工作。",
      follow_up: "你具体负责或参与了哪些模块、接口、测试或交付工作？"
    });
  } else {
    evidence.push("检测到个人贡献描述");
  }

  if (technologyMatches.length === 0) {
    addIssue(issues, {
      priority: 2,
      category: "项目上下文",
      title: "没有检测到明确技术栈",
      description: "简历中的项目描述暂时没有和具体技术、工具或开发场景建立联系。",
      follow_up: "请说明你在项目中实际使用了哪些技术，以及用它们解决了什么问题。"
    });
  } else {
    evidence.push(`检测到技术或工具：${[...new Set(technologyMatches)].slice(0, 8).join("、")}`);
  }

  if (body.mode === "targeted") {
    const detectedRequirements = JOB_REQUIREMENT_RULES.filter((rule) => {
      return rule.jobPattern.test(job);
    });
    const coveredRequirements = detectedRequirements.filter((rule) => {
      return rule.resumePattern.test(resume);
    });
    const missingRequirements = detectedRequirements.filter((rule) => {
      return !rule.resumePattern.test(resume);
    });

    if (coveredRequirements.length > 0) {
      evidence.push(`检测到岗位要求对应证据：${coveredRequirements.map((rule) => rule.label).join("、")}`);
    }

    if (missingRequirements.length > 0) {
      addIssue(issues, {
        priority: 1,
        category: "岗位要求覆盖",
        title: "部分岗位要求没有在简历中找到直接证据",
        description: `JD 中检测到但简历暂未出现明确证据的要求包括：${missingRequirements.slice(0, 6).map((rule) => rule.label).join("、")}。这只表示当前简历缺少证据，不代表你没有这些能力。`,
        follow_up: "请确认这些要求是否对应某段真实经历；如果有，请补充项目场景和个人贡献。"
      });
    }
  }

  return { issues, evidence };
}

function buildRuleResult(body) {
  const analysis = analyzeRules(body);
  const isTargeted = body.mode === "targeted";

  return {
    ok: true,
    mode: body.mode,
    analysis_type: "rules",
    summary: isTargeted
      ? "规则检查完成：先处理最影响岗位匹配度的证据缺口。"
      : "规则检查完成：先处理最影响简历可信度的证据缺口。",
    evidence_found: analysis.evidence,
    issues: analysis.issues.slice(0, 5),
    next_step: "这是确定性规则检查，不调用大模型，也不会补写简历中没有的数字或职责。"
  };
}

async function buildAnalysisResult(body) {
  const ruleResult = buildRuleResult(body);
  const engine = body.engine || "rules";

  if (engine === "rules") {
    return ruleResult;
  }

  const modelInput = buildModelInput({
    mode: body.mode,
    resumeText: body.resume_text,
    jobText: body.job_text || "",
    ruleResult
  });
  const modelAnalysis = engine === "deepseek"
    ? await callDeepSeek(modelInput)
    : runMockModel(modelInput);
  const outputError = validateModelOutput(modelAnalysis);

  if (outputError) {
    const error = new Error(outputError);
    error.code = "INVALID_MODEL_OUTPUT";
    throw error;
  }

  return {
    ok: true,
    mode: body.mode,
    analysis_type: engine === "deepseek" ? "hybrid-deepseek" : "hybrid-mock",
    rule_analysis: ruleResult,
    model_analysis: modelAnalysis
  };
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && serveLocalPage(request, response)) {
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-File-Name"
    });

    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/extract-resume") {
    handleTextFileExtraction(request, response);
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/analyze") {
    sendError(response, 404, "NOT_FOUND", "找不到这个接口。");
    return;
  }

  let rawBody = "";

  request.on("data", (chunk) => {
    rawBody += chunk;

    if (rawBody.length > 200000) {
      request.destroy();
    }
  });

  request.on("end", () => {
    let body;

    try {
      body = JSON.parse(rawBody);
    } catch {
      sendError(response, 400, "INVALID_JSON", "请求内容不是有效的 JSON。");
      return;
    }

    const validationError = validateRequest(body);

    if (validationError) {
      sendError(
        response,
        400,
        validationError.code,
        validationError.message
      );
      return;
    }

    buildAnalysisResult(body)
      .then((result) => {
        sendJson(response, 200, result);
      })
      .catch((error) => {
      sendError(
        response,
        error.code === "DEEPSEEK_KEY_MISSING" ? 500 : 502,
        error.code || "ANALYSIS_FAILED",
        error.message || "分析流程失败，请稍后重试。"
      );
      });
  });
});

server.listen(PORT, () => {
  console.log(`Resume audit API is running at http://localhost:${PORT}`);
  console.log(`Test endpoint: POST http://localhost:${PORT}/api/analyze`);
});
