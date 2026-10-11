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
node scripts/validate-roles.mjs            # 日常检查
node scripts/validate-roles.mjs --strict   # 提交前：要求所有子类达到 full
```

## 存量题库迁移

```bash
node --experimental-strip-types scripts/migrate-questions.mjs --dry-run
```
会按 `ROLE_ID_MAP` 把 `src/config/` 下的题库按岗位归位。可重复执行（按题目 id 去重）。

> 已知事实：现存 356 题**全部**是计算机/后端向，因此只流向 `cs-it.backend`。
> 非计算机岗位的内容必须新采 —— 不要把题量当成岗位覆盖度。
