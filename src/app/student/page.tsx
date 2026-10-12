import { notFound } from "next/navigation";
import { FEATURE_STUDENT_PATH } from "@/config/features";
import StudentPlannerPage from "./StudentPlannerPage";

/**
 * 大学生学习路径规划（`/student`）。
 *
 * 这一层只做**开关判断**，真正的页面在 `StudentPlannerPage.tsx` 里，一行没删。
 * 为什么要包一层而不是直接在页面里判断：
 * - 服务端判断能让功能关闭时**连客户端包都不发**给用户，也不会在渲染时闪一下
 * - 页面代码完全不用为了"可能被关掉"这件事写分支
 *
 * 关闭原因见 `src/config/features.ts`。
 */
export default function Page() {
  if (!FEATURE_STUDENT_PATH) notFound();
  return <StudentPlannerPage />;
}
