/**
 * 岗位题库批量扩写脚本。
 *
 * ## 为什么要用脚本生成，而不是手写
 * 64 个岗位若都要达到「计算机类」那样厚实的题库，需要上万道题。
 * 现有轻量岗位每岗只有 10 题左右，靠人工逐条写不现实。
 *
 * ## 来源标注（重要）
 * 生成的题目一律标注为 `ai-generated`，name 里写明「参考公开面经题型扩写」——
 * 因为 prompt 里确实带了**网络调研得到的真实面试题型**作为锚点，
 * 但题目本身是生成的，**不是**逐字抄自某个来源。
 * 真实逐字引用的题目由人工单独补录并标 `public-post` + 来源链接。
 *
 * ## 幂等
 * 按「目标题数」补齐：已达标就跳过，可反复运行（分多次跑避免单次调用过长）。
 *
 * 用法：
 *   node scripts/expand-role-questions.mjs                 # 全部岗位补到默认目标
 *   node scripts/expand-role-questions.mjs --target 40     # 指定目标题数
 *   node scripts/expand-role-questions.mjs --only cs-it    # 只处理某个大类
 *   node scripts/expand-role-questions.mjs --per-call 16   # 单次每岗生成多少道
 *   node scripts/expand-role-questions.mjs --dry-run       # 只看计划不调用
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const argValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const TARGET = Number(argValue("--target") ?? 40);
const PER_CALL = Number(argValue("--per-call") ?? 10);
const ONLY = argValue("--only");
const DRY_RUN = argv.includes("--dry-run");
const COLLECTED_AT = "2026-10-15";

// ---------- 读取密钥 ----------
function loadEnv() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) throw new Error("缺少 .env.local");
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const API_KEY = env.OPENAI_API_KEY || env.FALLBACK_API_KEY;
const BASE_URL = (env.OPENAI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const MODEL = env.ANALYSIS_MODEL || env.INTERVIEW_MODEL || "deepseek-chat";

/**
 * 各大类的真实面试题型锚点。
 *
 * 全部来自本次网络调研（来源见 docs 或 data/roles/来源与覆盖说明.md），
 * 只用作**把握提问风格与深度**的参考，不逐字抄写。
 */
const CATEGORY_REFERENCES = {
  "edu-research": `教师招聘结构化面试的真实题型（来源：华图教师招聘面试题库、欣瑞教育《教师招聘考试结构化面试试题》、应届毕业生网《教师结构化面试》）：
- 课堂突发情况处理：学生上课传纸条怎么办／学生上课跑神且不带文具怎么办
- 学生心理与家校沟通：学生早恋怎么处理／家长要求给孩子调座位怎么办／学生放学情绪低落家长来电怎么办
- 教育理念辨析：「学生课业压力普遍很重」怎么看／「教师偏爱成绩好的学生」怎么看／「教案直接用网上的」怎么看
- 教学实操：为某知识点设计导入环节／用最通俗的话给初中生解释某概念
- 职业认知：为什么选择教师行业／如何看待教师这个职业／谈谈你的缺点`,

  "med-life": `医疗护理岗位的真实面试题型（来源：中公医考网《执业护士考试常见面试问题汇总》、应届毕业生网《医院护理面试常见问题》、面试123网《医院护士面试常考20题》）：
- 临床操作规范：输液出现不良反应如何处理／配药液前的注意事项／七步洗手法要多久／洗胃禁忌症
- 医嘱与用药安全：医嘱用药间隔未到但病人疼痛剧烈怎么办／手术后纱布数量对不上如何处理
- 应急处置：值班时病人突然晕倒怎么办／发现群体性中毒如何处理／患者家属情绪激动如何处理
- 职业素养：为什么选择护理／病人康复只感谢医生怎么看／同事间关系紧张如何改善／如何看待收受红包
- 专业知识：一级护理质量标准／输血输液反应／三查八对内容`,

  "finance-econ": `财会金融岗位的真实面试题型（来源：华图《银保监会财会岗面试真题（2017–2019 各批次）》、搜狐《面试常见考题精选》、人人文库《银行审计岗面试题》）：
- 专业知识辨析：会计政策与会计估计的理解／客观性与谨慎性是否冲突／资产负债率从管理者·投资者·债权人角度的不同解读／如何衡量企业偿债能力
- 行业判断：人工智能是否会取代财会人员／注册会计师审计失败的原因与改善／银行拨备压力的会计分析
- 情景处置：审计发现违规但负责人暗示网开一面／审计发现重要文件缺失／审计意见与同事分歧
- 岗位认知：如何运用会计学审计学知识做商业银行现场监察／提高资本市场会计信息质量对投资者的意义
- 通用素养：同事关系不融洽怎么办／领导交办任务一周完成不了如何沟通（现场模拟）`,

  "law-public": `法律与公职岗位的真实面试题型（来源：华图《广东法检系统公务员面试真题》、山东人才就业网《陕西省公务员面试（执法、公检法）真题》、原创力文档《公务员面试法律面试题》）：
- 法治素养与社会观察：法院用 AI 辅助量刑（律师担心数字黑洞）怎么看／「法要兼顾人情、法不外乎人情」的认识／酒驾入罪的看法
- 现场执法处置：醉酒人员与餐馆老板纠纷引发围观拍照，作为现场执法人员怎么办／群众在办公室大吵大闹如何处置
- 人际关系：与同事在法律观点上分歧如何处理／领导安排你与强势同事合作怎么办／其他部门拖延进度如何协调
- 应急应变：开庭前关键证据丢失怎么办／紧急法律事务与同事求助冲突如何取舍
- 岗位认知：为什么选择法律工作／优秀法律工作者应具备哪些素质`,

  "mech-mfg": `机械制造岗位的真实面试题型（来源：CATKing 工程类面试题库、UC Davis AvenueE 工程面试题集）：
- 专业基础：应力应变曲线／卡尺与公差／疲劳强度高低材料举例／四冲程与二冲程区别
- 工艺与质量：六西格玛过程能力／批量生产与单件生产的差异／如何做失效分析
- 项目与设计：最有挑战的工程项目／如何确保设计不出错（校核手段）／用过哪些设计软件、最擅长什么
- 现场问题：产线出现批量不良如何处置／工艺参数与图纸不符怎么办`,

  "ee-telecom": `电子通信岗位的真实面试题型（来源：CATKing 工程类面试题库、伊利诺伊大学技术面试指南）：
- 电路基础：三极管工作原理／NPN 与 PNP 区别／低通与高通滤波器／CMOS 是什么
- 数字与嵌入式：触发器原理／触发器与锁存器的区别／单片机与微处理器区别／中断与轮询如何取舍
- 通信原理：调制是什么／CDMA 工作原理／无线信号为何随距离衰减／VLAN 与蓝牙
- 工程实践：给出一个受控反馈系统的例子／如何排查一块不工作的板子／示波器与万用表的使用场景`,

  "energy-chem": `化工能源岗位的真实面试题型（来源：CATKing 工程类面试题库、伊利诺伊大学技术面试指南）：
- 单元操作与传递：单元操作与单元过程的区别／传热的基本方式／黏度与表面张力举例／雷诺数的物理意义
- 安全与环保：有毒有害气体举例／报警响起时你该怎么做／ flare（火炬）是什么、什么时候用
- 工艺与设备：如何估算泵的效率／输送浆料的管路要考虑什么／露点与闪点的区别
- 分析检测：如何判断一个分析方法是否稳定指示／配溶液的换算`,

  "civil-arch": `土木建筑岗位的真实面试题型（来源：CATKing 工程类面试题库、UC Davis AvenueE 工程面试题集、Chalized 工程师面试问题）：
- 结构与力学：简支梁与悬臂梁的支承条件／弯矩与剪力／应力应变曲线／抗震结构怎么做
- 地基与施工：软土地基选什么基础／高架桥用什么基础／砖为什么是红色
- 项目管理：CPM 与 PERT 的区别与适用场景／经济订货量／甘特图与看板
- 工具与现场：用过 CAD 还是 MATLAB／现场工作最有挑战的地方是什么／图纸与现场不符如何处理`,

  "business-hr": `商科岗位（市场/销售/HR/客服/供应链）的真实面试题型（来源：应届毕业生网、面试123网常见面试问题集）：
- 情景应对：客户投诉且情绪激动如何处理／重要客户临时压价怎么办／供应商断供如何应急
- 数据与判断：如何衡量一次营销活动的效果／如何判断一个渠道值不值得投／库存周转率低怎么改善
- 沟通协作：跨部门推不动怎么办／与强势同事合作／向上级汇报坏消息
- 岗位认知：为什么做销售／如何看待业绩压力／你认为优秀的客服/HR 应该具备什么`,

  "media-culture": `传媒文化岗位的真实面试题型（来源：应届毕业生网面试问题集、行业公开面经）：
- 内容判断：给你一个热点，怎么判断值不值得做／标题党与真实性的边界在哪
- 实操能力：如何做一次选题策划／采访前你会做哪些准备／稿件被大幅删改你怎么看
- 数据与效果：如何评估一篇文章/一条视频的效果／阅读量高但转化低怎么解释
- 职业素养：如何看待内容审核与创作自由的关系／截稿压力下如何保证质量`,

  "cs-it": `计算机岗位的真实面试题型（来源：项目内既有 356 题题库，含公开题库）：
- 算法与数据结构：数组/链表/树/图/动态规划/哈希
- 系统设计：缓存、一致性、限流、分库分表、高并发
- 工程实践：调试、性能优化、代码评审、线上故障排查
- 行为面：最有挑战的项目、与同事技术分歧、如何学习新技术`,
};

// ---------- 调用模型 ----------
async function callModel(prompt) {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "你是资深招聘面试官与职业能力测评设计者，只输出严格合法的 JSON，不要任何解释或 markdown 代码块标记。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/**
 * 从模型输出里稳健地取出 JSON 数组。
 *
 * 模型偶尔会给出**截断**或**含未转义引号**的 JSON（实测 12/63 次）。
 * 因此不能只靠一次 JSON.parse：
 *   1. 先整体解析
 *   2. 失败则逐个抠出完整的 `{...}` 对象单独解析，能救回几道算几道
 *      —— 宁要 7 道合规的，也不要整批丢弃重来
 */
function extractJson(text) {
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("[");
  if (start < 0) throw new Error("输出里找不到 JSON 数组");
  const body = s.slice(start);

  try {
    return JSON.parse(body.slice(0, body.lastIndexOf("]") + 1 || undefined));
  } catch {
    // 抢救：按大括号配对切出完整对象
    const objects = [];
    let depth = 0;
    let buf = "";
    let inString = false;
    let escaped = false;

    for (const ch of body) {
      if (escaped) { escaped = false; buf += ch; continue; }
      if (ch === "\\") { escaped = true; buf += ch; continue; }
      if (ch === '"') { inString = !inString; buf += ch; continue; }
      if (!inString) {
        if (ch === "{") { if (depth === 0) buf = ""; depth += 1; buf += ch; continue; }
        if (ch === "}") {
          depth -= 1;
          buf += ch;
          if (depth === 0) {
            try { objects.push(JSON.parse(buf)); } catch { /* 跳过坏对象 */ }
            buf = "";
          }
          continue;
        }
        if (depth === 0) continue;
      }
      buf += ch;
    }

    if (objects.length === 0) throw new Error("输出里找不到可解析的题目对象");
    return objects;
  }
}

function buildPrompt(role, need, attempt = 1) {
  const perStage = Math.ceil(need / 4);
  const dims = (role.dimensions ?? [])
    .map((d, i) => `  ${i + 1}. ${d.name}（权重${d.weight}）：${d.why}`)
    .join("\n");
  const refs = CATEGORY_REFERENCES[role.categoryId] ?? "";

  return `请为「${role.label}」岗位生成 ${need} 道结构化面试题。

【岗位信息】
- 岗位简介：${role.summary}
- 岗位描述：${String(role.description).slice(0, 300)}
- 核心技能：${(role.skills ?? []).join("、")}
- 考察维度：
${dims}

【面试轮次 stage 取值】
algorithm = 专业能力面（岗位核心专业能力）
project = 经历深挖面（简历/项目/实习经历深挖）
cross = 综合应变面（跨领域协作、突发情况、沟通表达）
hr = HR 面（求职动机、职业规划、团队协作、期望）

【参考真实面试题型】（来自公开面经，只用于把握提问风格与深度，**不要照抄**）
${refs}

【硬性要求】
1. 每道题必须贴合「${role.label}」的实际工作内容，不能是放之四海皆准的通用题
2. 轮次分布：四个 stage 各约 ${perStage} 道
3. 难度分布：easy / medium / hard 大致 3:5:2
4. 题干要具体——含情境、约束条件或考察要点，能区分「真做过」与「背答案」的人
5. title 为不超过 20 字的短标题；content 为完整题干（60–160 字）
6. tags 为 2–3 个中文关键词
7. 与已有题目不要重复（已有题目示例：${(role.questions ?? []).slice(-3).map((q) => q.title).join("；") || "无"}）

【输出格式】只输出 JSON 数组，第一个字符必须是 [ ，最后一个字符必须是 ] ：
[{"stage":"algorithm","difficulty":"medium","title":"短标题","content":"完整题干","tags":["标签1","标签2"]}]
${attempt > 1 ? "\n⚠️ 上一次输出不是合法 JSON。这次务必：字符串内不要出现未转义的英文双引号（需要引用时用中文引号「」）；不要在数组前后加任何说明文字。" : ""}`;
}

// ---------- 主流程 ----------
function listRoleFiles() {
  const files = [];
  for (const entry of readdirSync(ROLES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (ONLY && entry.name !== ONLY) continue;
    for (const file of readdirSync(join(ROLES_DIR, entry.name))) {
      if (file.endsWith(".json")) files.push(join(ROLES_DIR, entry.name, file));
    }
  }
  return files.sort();
}

async function main() {
  const files = listRoleFiles();
  console.log(`目标：每岗补到 ${TARGET} 题（单次每岗最多新增 ${PER_CALL} 题）`);
  console.log(`模型：${MODEL}  共 ${files.length} 个岗位文件\n`);

  let processed = 0;
  let added = 0;
  let skipped = 0;
  const failures = [];

  for (const path of files) {
    const role = JSON.parse(readFileSync(path, "utf8"));
    const current = (role.questions ?? []).length;

    if (current >= TARGET) {
      skipped += 1;
      continue;
    }

    const need = Math.min(PER_CALL, TARGET - current);
    if (DRY_RUN) {
      console.log(`  [dry] ${role.label}：${current} → ${current + need}`);
      continue;
    }

    let items = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3 && !items; attempt += 1) {
      try {
        const raw = await callModel(buildPrompt(role, need, attempt));
        const parsed = extractJson(raw);
        if (Array.isArray(parsed) && parsed.length > 0) items = parsed;
        else lastError = new Error("模型返回空数组");
      } catch (err) {
        lastError = err;
      }
    }

    try {
      if (!items) throw lastError ?? new Error("生成失败");

      const existing = role.questions ?? [];
      const startIndex = existing.length + 1;

      const appended = items.slice(0, need).map((item, i) => ({
        // id 按序号顺延（3 位补零），与既有题目命名保持一致
        id: `${role.id}-q${String(startIndex + i).padStart(3, "0")}`,
        stage: ["algorithm", "project", "cross", "hr"].includes(item.stage) ? item.stage : "algorithm",
        difficulty: ["easy", "medium", "hard"].includes(item.difficulty) ? item.difficulty : "medium",
        title: String(item.title ?? "").slice(0, 40),
        content: String(item.content ?? "").slice(0, 400),
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 3).map(String) : [],
        source: {
          type: "ai-generated",
          name: "AI 批量扩写（参考公开面经题型）",
          collectedAt: COLLECTED_AT,
        },
      })).filter((q) => q.title && q.content);

      role.questions = [...existing, ...appended];
      role.meta = { ...(role.meta ?? {}), updatedAt: COLLECTED_AT };
      writeFileSync(path, JSON.stringify(role, null, 2) + "\n", "utf8");

      processed += 1;
      added += appended.length;
      console.log(`  ✓ ${role.label}：${current} → ${role.questions.length}（+${appended.length}）`);
    } catch (err) {
      failures.push({ role: role.label, error: err.message });
      console.log(`  ✗ ${role.label}：${err.message}`);
    }
  }

  console.log(`\n完成：处理 ${processed} 个岗位，新增 ${added} 道题，跳过（已达标）${skipped} 个`);
  if (failures.length) {
    console.log(`失败 ${failures.length} 个：`);
    failures.forEach((f) => console.log(`  - ${f.role}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error("脚本失败:", err);
  process.exit(1);
});
