# 岗位数据（data/roles）

岗位体系的数据源。**一个子类一个 JSON 文件**，代码不再硬编码岗位。

## 目录结构

```
data/roles/
  taxonomy.json          分类索引：11 大类 / 64 细分小类
  <categoryId>/
    <subId>.json         子类内容
```

## 加一个岗位要做什么

1. 在 `taxonomy.json` 对应大类的 `subcategories` 里登记 `{ id, label, aliases }`
2. 建 `data/roles/<categoryId>/<subId>.json`，字段见 `src/lib/job-roles/types.ts`
3. 跑 `node scripts/validate-roles.mjs`，绿灯即可

## 三条硬规矩

1. **每条题目 / 公司 / 面经都必须带 `source`**。赛事要求使用外部数据须说明来源；
   `public-bank` / `company-jd` / `official` / `public-post` 四类**必须给出可核验链接**，
   校验脚本会拦。
2. **AI 生成的内容必须自报家门**（`source.type = "ai-generated"`），
   **不得冒充真实面经**。
3. **`id` 入库后不可改**（历史面试记录依赖它）。

## 校验

```bash
pnpm roles:validate            # 日常检查
pnpm roles:validate:strict     # 提交前：要求所有子类达到 full 档
```

规则本身在 `src/lib/job-roles/validate.ts`，**运行时加载层与这个 CLI 共用同一份**。
不要为了省一个参数而各写一份 —— 分叉的校验等于没有校验。

## 远程热更新（岗位/题库不发版也能改）

```bash
pnpm roles:bundle            # 打包成 data/roles-bundle.json（打包前强制校验）
pnpm roles:bundle -- --bump  # 版本号 +1
```

把产物托管到任意静态地址（建议开 gzip/br，压缩后通常只剩十分之一），
配到环境变量即可：

```bash
OPC_ROLES_URL=https://example.com/roles-bundle.json
OPC_ROLES_REFRESH_MINUTES=30   # 检查间隔，默认 30 分钟；0 等同关闭
```

行为约定：

- **原子替换**：整个数据包一次拉下来，不会出现"更新到一半"的半新半旧状态
- **先校验后替换**：数据包必须通过同一套校验规则才生效。校验不过 → 拒绝，沿用当前数据
- **失败不致命**：拉取失败 / 超时 / 校验不通过，全部只记日志，应用照常可用
- **版本可见**：`/api/roles` 的 `meta` 与 `/studio` 的「岗位数据」卡片会显示
  当前版本、来源（随代码发布 / 远程热更新）、上次检查时间与最近一次失败原因
- 数据包 `data/roles-bundle.json` 是**派生产物，不入库**（入库会与源数据漂移）

## 存量题库迁移

```bash
node --experimental-strip-types scripts/migrate-questions.mjs --dry-run
```

> 已知事实：现存 356 题**全部**是计算机/后端向，因此只流向 `cs-it.backend`。
> 非计算机岗位的内容必须新采 —— 不要把题量当成岗位覆盖度。

## 批量生成内容

```bash
pnpm roles:generate -- --category finance-econ
pnpm roles:generate -- --only a.b,c.d --dry-run
```

> ⚠️ 生成器会**覆盖**目标子类的 `dimensions`。
> cs-it 下 8 个岗位的维度是人工精心撰写的（质量高于 AI 生成），
> 曾被生成器覆盖过一次，靠 `scripts/migrate-dimensions.mjs` 抢救回来。
> **跑生成器前先确认目标文件里有没有人工内容。**
