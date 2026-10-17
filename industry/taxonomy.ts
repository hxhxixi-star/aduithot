// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（教程、观点）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "social", label: "社会责任", feedLabel: "社会责任审核", section: "社会责任审核/更新", guide: "社会责任与劳工权益审核相关：SLCP、BSCI/SMETA、SEDEX、WRAP、ICTI、RBA 等体系的评估与更新，工资工时、童工、强迫劳动、健康安全等符合性问题，客户社会责任验厂的要求与结果。纯粹的劳工新闻、没有审核或合规维度的不收。" },
  { key: "quality", label: "质量体系", feedLabel: "质量体系审核", section: "质量与安全审核/更新", guide: "质量管理体系与质量审核相关：ISO 9001、IATF 16949、客户质量审核（FCCA/QMS）、过程审核、产品检验与验货标准的变化。单纯的产品质量投诉、没有体系或审核维度的不收。" },
  { key: "security", label: "反恐安全", feedLabel: "反恐安全审核", section: "质量与安全审核/更新", guide: "供应链反恐与安全审核相关：C-TPAT、GSV/SCAN、ISO 28000、AEO、海关安全合规、实体安全与访问控制要求。一般的社会治安新闻不收。" },
  { key: "chemical", label: "化学品", feedLabel: "化学品与环保", section: "化学品与合规/更新", guide: "化学品与环保合规相关：ZDHC（MRSL/RSL）、REACH、SVHC、OEKO-TEX、GOTS、bluesign、碳排放与减排要求，有害物质限制清单更新与检测要求变化。普通化工行业经营新闻不收。" },
  { key: "policy", label: "法规政策", feedLabel: "法规与政策", section: "化学品与合规/更新", guide: "影响验厂与供应链合规的法规政策：欧盟 CSDDD、德国供应链法（LkSG）、美国 UFLPA、海关与贸易合规新政、各国劳动与环保法规修订、官方执法与处罚案例。与具体审核体系直接相关的优先归入对应审核类别。" },
  { key: "industry", label: "行业", feedLabel: "行业动态", section: "行业动态", guide: "已发生的机构经营、合作并购、人事、认证认可资质变化、行业会议与报告发布、真实违规事件及调查进展。新闻由当事人发帖、带有态度，也不因此变成观点。" },
  { key: "tip", label: "实务", section: "实务与观点", guide: "读者可以照着做的验厂准备、文件记录、现场管理、不符合项整改、审核应对的方法与复盘。重点是可复用的做法；单纯发布工具归行业，只有态度和预测而无做法归观点。", commentary: true },
  { key: "opinion", label: "观点", section: "实务与观点", guide: "重点是作者的解释、判断、主张、预测、评论或访谈观点。讨论行业趋势不自动归行业，作者是名人不自动归观点。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布（AI 行业是新模型，验厂行业是标准/要求更新）：日报报头的“N 项新要求”、改分类后修订已出的报告都按它数。
 * category 是类别，tag 是标签，两者都对上才算；unit 接在数字后面。
 * 没有这样一类的行业设成 null，报头就不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "social", tag: "标准更新", unit: "项新要求" };

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = ["iso", "rsl", "mrsl", "reach", "zdhc", "bmsr", "gots", "ceo", "c-tpat", "svhc", "aql"];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["standard_update", "scheme_requirement", "practice_method", "regulatory_event", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "标准更新", "体系要求", "审核实务", "整改指南", "法规政策", "化学品合规", "社会责任", "质量审核", "供应链安全",
  "行业动态", "观点洞察", "培训/活动", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "SLCP", "BSCI/SMETA", "C-TPAT/GSV", "ZDHC", "REACH/RSL", "ISO 9001", "IATF 16949", "WRAP", "OEKO-TEX", "GOTS",
  "验厂准备", "不符合项整改", "工资工时", "工时考勤", "消防安全", "环境合规", "文件记录", "现场管理", "供应商管理", "碳与可持续",
] as const;

/** 可选的实体标签（公司、机构、平台）。 */
export const ENTITY_TAGS = ["SGS", "BV", "Intertek", "TÜV", "UL", "amfori", "Sedex", "SLCP", "ZDHC", "ICTI", "WRAP", "RBA", "OEKO-TEX", "Cascale"] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "社会责任审核": "社会责任", "社会责任验厂": "社会责任", "劳工审核": "社会责任", "人权审核": "社会责任",
  smeta: "BSCI/SMETA", bsci: "BSCI/SMETA", amfori: "BSCI/SMETA", "slcp验厂": "SLCP", "slcp评估": "SLCP",
  "反恐验厂": "供应链安全", "反恐审核": "供应链安全", "c-tpat": "C-TPAT/GSV", ctpat: "C-TPAT/GSV", gsv: "C-TPAT/GSV", "scan审核": "C-TPAT/GSV",
  "质量验厂": "质量审核", fcca: "质量审核", "体系审核": "体系要求", iso9001: "ISO 9001",
  "化学品管理": "化学品合规", "有害物质": "化学品合规", "rsl清单": "REACH/RSL", mrsl: "ZDHC", "零排放": "ZDHC",
  标准: "标准更新", 新规: "法规政策", 法规: "法规政策", 监管: "法规政策", 合规: "法规政策",
  实务: "审核实务", 技巧: "审核实务", 指南: "整改指南", 整改: "整改指南", 教程: "审核实务", 培训: "培训/活动",
  动态: "行业动态", 行业: "行业动态", 观点: "观点洞察", 趋势: "观点洞察", 洞察: "观点洞察", 评论: "观点洞察",
  sustainability: "碳与可持续", esg: "碳与可持续", 碳中和: "碳与可持续",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；otherNames 是公司自己的其他称呼（官方账号名、子品牌），
 * 把事实的主体对到发布方时也认它们。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; otherNames?: string[] }> = {
  slcp: { name: "SLCP", displayTag: "SLCP", aliases: ["SLCP", "Social & Labor Convergence Program", "社会劳工融合项目"] },
  amfori: { name: "amfori", displayTag: "amfori", aliases: ["amfori", "BSCI", "amfori BSCI"], otherNames: ["amfori BEPI"] },
  sedex: { name: "Sedex", displayTag: "Sedex", aliases: ["Sedex", "SMETA"], otherNames: ["Supplier Ethical Data Exchange"] },
  zdhc: { name: "ZDHC", displayTag: "ZDHC", aliases: ["ZDHC", "Zero Discharge of Hazardous Chemicals", "有害化学物质零排放"] },
  wrap: { name: "WRAP", displayTag: null, aliases: ["WRAP", "Worldwide Responsible Accredited Production"] },
  icti: { name: "ICTI", displayTag: null, aliases: ["ICTI", "ICTI Ethical Toy Program", "ICTI CARE"] },
  rba: { name: "RBA", displayTag: null, aliases: ["RBA", "Responsible Business Alliance", "EICC"] },
  "oeko-tex": { name: "OEKO-TEX", displayTag: "OEKO-TEX", aliases: ["OEKO-TEX", "OEKO TEX", "国际纺织和皮革生态学研究与检测协会"] },
  sgs: { name: "SGS", displayTag: "SGS", aliases: ["SGS", "通标"] },
  bv: { name: "Bureau Veritas", displayTag: "BV", aliases: ["Bureau Veritas", "BV", "必维"] },
  intertek: { name: "Intertek", displayTag: "Intertek", aliases: ["Intertek", "天祥"] },
  "tuv-rheinland": { name: "TÜV Rheinland", displayTag: null, aliases: ["TÜV Rheinland", "TUV Rheinland", "莱茵"] },
  "tuv-sud": { name: "TÜV SÜD", displayTag: null, aliases: ["TÜV SÜD", "TUV SUD", "南德"] },
  ul: { name: "UL Solutions", displayTag: null, aliases: ["UL", "UL Solutions", "UL认证"] },
  cascale: { name: "Cascale", displayTag: null, aliases: ["Cascale", "Higg", "SAC", "Sustainable Apparel Coalition"], otherNames: ["Higg FEM", "Higg Index"] },
  "textile-exchange": { name: "Textile Exchange", displayTag: null, aliases: ["Textile Exchange"] },
  "us-cbp": { name: "美国 CBP", displayTag: null, aliases: ["CBP", "U.S. Customs and Border Protection", "美国海关"] },
  echa: { name: "ECHA", displayTag: null, aliases: ["ECHA", "European Chemicals Agency", "欧洲化学品管理局"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "slcp", name: "SLCP", patterns: [/\bSLCP\b|social\s*&\s*labor\s*convergence/i] },
  { id: "amfori", name: "amfori / BSCI", patterns: [/amfori|\bBSCI\b/i] },
  { id: "sedex", name: "Sedex / SMETA", patterns: [/sedex|\bSMETA\b/i] },
  { id: "zdhc", name: "ZDHC", patterns: [/\bZDHC\b|zero\s*discharge/i] },
  { id: "wrap", name: "WRAP", patterns: [/\bWRAP\b|worldwide\s*responsible/i] },
  { id: "icti", name: "ICTI", patterns: [/\bICTI\b|ethical\s*toy/i] },
  { id: "rba", name: "RBA", patterns: [/\bRBA\b|responsible\s*business\s*alliance|\bEICC\b/i] },
  { id: "oeko-tex", name: "OEKO-TEX", patterns: [/oeko[-\s]?tex/i] },
  { id: "sgs", name: "SGS", patterns: [/\bSGS\b|通标/i] },
  { id: "bv", name: "Bureau Veritas", patterns: [/bureau\s*veritas|\bBV\b|必维/i] },
  { id: "intertek", name: "Intertek", patterns: [/intertek|天祥/i] },
  { id: "tuv", name: "TÜV", patterns: [/tüv|\btuv\b|莱茵|南德/i] },
  { id: "cascale", name: "Cascale / Higg", patterns: [/cascale|\bhigg\b|sustainable\s*apparel/i] },
  { id: "echa", name: "ECHA", patterns: [/\bECHA\b|european\s*chemicals/i] },
  { id: "us-cbp", name: "美国 CBP", patterns: [/\bCBP\b|customs\s*and\s*border|美国海关/i] },
];

/** 这些域名上的文章，发布方就是对应的公司（托管平台如 GitHub、arXiv 不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "slcp", domains: ["slconvergence.org"] },
  { entityId: "amfori", domains: ["amfori.org"] },
  { entityId: "sedex", domains: ["sedex.com"] },
  { entityId: "zdhc", domains: ["zdhc.org"] },
  { entityId: "wrap", domains: ["wrapcompliance.org"] },
  { entityId: "icti", domains: ["ethicaltoy.org"] },
  { entityId: "rba", domains: ["responsiblebusiness.org"] },
  { entityId: "oeko-tex", domains: ["oeko-tex.com"] },
  { entityId: "sgs", domains: ["sgs.com"] },
  { entityId: "bv", domains: ["bureauveritas.com", "group.bureauveritas.com"] },
  { entityId: "intertek", domains: ["intertek.com"] },
  { entityId: "tuv-rheinland", domains: ["tuv.com", "tuv-rheinland.com"] },
  { entityId: "tuv-sud", domains: ["tuvsud.com"] },
  { entityId: "cascale", domains: ["cascale.org"] },
  { entityId: "textile-exchange", domains: ["textileexchange.org"] },
  { entityId: "us-cbp", domains: ["cbp.gov"] },
  { entityId: "echa", domains: ["echa.europa.eu"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "amfori", pattern: /@amfori_org\b/i },
  { entityId: "sedex", pattern: /@Sedex_(?:news|global)\b/i },
  { entityId: "zdhc", pattern: /@ZDHC\b/i },
];
