import { cookies } from "next/headers";
import { StudioGate } from "@/components/studio/StudioGate";
import { STUDIO_COOKIE, USING_DEFAULT_PASSWORD, isStudioUnlocked } from "@/lib/studio-auth";
import StudioDashboard from "./StudioDashboard";

/**
 * OPC 运营看板（`/studio`）。
 *
 * 这一层只做**口令门**，真正的看板在 `StudioDashboard.tsx` 里。
 *
 * 为什么门放在服务端而不是页面里判断：
 * - 未解锁时连看板的客户端包都不会发出去，打开 devtools 也看不到数据逻辑
 * - 看板本身不用为了"可能未解锁"写分支
 *
 * 定位说明：这个页面**不是给用户看的功能**，是评委核验 OPC 成果的工具，
 * 所以它不在首页的入口列表里，只在右下角留一个小入口。
 */
export default async function Page() {
  // 安全网：生产环境还用内置默认口令时提醒一句。
  // 默认口令写在代码里，仓库一旦公开就等于公开了 —— 这条日志是为了不留这个盲区。
  if (process.env.NODE_ENV === "production" && USING_DEFAULT_PASSWORD) {
    console.warn(
      "[studio] 正在使用内置默认口令。看板属内部工具，公开部署前请设置环境变量 STUDIO_PASSWORD。"
    );
  }

  const store = await cookies();
  const unlocked = isStudioUnlocked(store.get(STUDIO_COOKIE)?.value);

  if (!unlocked) return <StudioGate />;
  return <StudioDashboard />;
}
