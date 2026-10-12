import type { RoleBundle } from "@/lib/job-roles/types";
import { applyBundle, getRoleDataMeta } from "@/lib/job-roles/loader";
import { validateRoleData } from "@/lib/job-roles/validate";

/**
 * 岗位数据的远程热更新。
 *
 * 对应 OPC 五特征里的「持续迭代」：岗位与题库不是"发版才能改"的死数据，
 * 改一个远程文件、应用无需重启即可生效。
 *
 * 设计取舍：
 * - **单个数据包**而不是逐个文件拉：一次请求、原子替换，
 *   避免"更新到一半"导致岗位列表半新半旧
 * - **先校验后替换**：数据包必须通过 `validateRoleData` 才允许生效。
 *   热更新通道是最容易把脏数据送进线上的地方，这道关不能省
 * - **失败一律回退**：拉取失败、超时、校验不通过，全部只记日志、
 *   沿用当前生效的数据。岗位数据挂掉会让整个产品不可用，不值得冒这个风险
 * - **TTL 节流**：默认 30 分钟才检查一次，避免每个请求都打网络
 */

const BUNDLE_URL = process.env.OPC_ROLES_URL?.trim() || "";
const REFRESH_MINUTES = Number(process.env.OPC_ROLES_REFRESH_MINUTES ?? 30);
const FETCH_TIMEOUT_MS = 8000;
/** 数据包体积上限，防止误指向一个大文件把内存打满 */
const MAX_BUNDLE_BYTES = 20 * 1024 * 1024;

export type FetchOutcome = { ok: true; bundle: RoleBundle } | { ok: false; error: string };

export function isRemoteRefreshEnabled(): boolean {
  return BUNDLE_URL.length > 0 && Number.isFinite(REFRESH_MINUTES) && REFRESH_MINUTES > 0;
}

function refreshIntervalMs(): number {
  return REFRESH_MINUTES * 60 * 1000;
}

/** 拉取并校验数据包。任何一步失败都返回原因，由调用方决定如何记录。 */
export async function fetchRoleBundle(url = BUNDLE_URL): Promise<FetchOutcome> {
  if (!url) return { ok: false, error: "未配置 OPC_ROLES_URL" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) return { ok: false, error: `远程数据包返回 HTTP ${response.status}` };

    const raw = await response.text();
    if (raw.length > MAX_BUNDLE_BYTES) {
      return { ok: false, error: `远程数据包过大（${raw.length} 字节）` };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "远程数据包不是合法 JSON" };
    }

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "远程数据包结构非法" };
    }

    const bundle = parsed as Partial<RoleBundle>;
    if (!bundle.taxonomy || !bundle.contents || typeof bundle.contents !== "object") {
      return { ok: false, error: "远程数据包缺少 taxonomy 或 contents" };
    }

    // 关键：先校验。校验不通过的数据包一律不生效。
    const outcome = validateRoleData(
      bundle.taxonomy,
      Object.entries(bundle.contents).map(([id, data]) => ({ expectedId: id, data }))
    );
    if (!outcome.ok) {
      const sample = outcome.errors
        .slice(0, 3)
        .map((e) => `${e.where}: ${e.message}`)
        .join("；");
      return {
        ok: false,
        error: `远程数据包校验未通过（${outcome.errors.length} 个错误）—— ${sample}`,
      };
    }

    return {
      ok: true,
      bundle: {
        version: Number(bundle.version) || 0,
        updatedAt: String(bundle.updatedAt ?? ""),
        taxonomy: bundle.taxonomy,
        contents: bundle.contents,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `拉取失败：${message}` };
  } finally {
    clearTimeout(timer);
  }
}

let inFlight: Promise<boolean> | null = null;

/**
 * 按需刷新（TTL 内直接返回，不阻塞请求）。
 *
 * @returns 是否成功换成远程数据
 */
export async function ensureFreshRoles(force = false): Promise<boolean> {
  if (!isRemoteRefreshEnabled()) return false;

  const meta = getRoleDataMeta();
  const lastChecked = meta.lastCheckedAt ? new Date(meta.lastCheckedAt).getTime() : 0;
  if (!force && Date.now() - lastChecked < refreshIntervalMs()) return false;

  // 已有一个刷新在跑就复用它，避免并发拉起多个请求
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const previousVersion = meta.version;
    const outcome = await fetchRoleBundle();

    if (!outcome.ok) {
      console.warn(`[job-roles] 远程热更新未生效（${outcome.error}），沿用当前数据`);
      applyBundle(null, outcome.error);
      return false;
    }

    applyBundle(outcome.bundle);
    if (outcome.bundle.version !== previousVersion) {
      console.log(
        `[job-roles] 岗位数据已热更新：v${previousVersion} → v${outcome.bundle.version}（${outcome.bundle.updatedAt}）`
      );
    }
    return true;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
