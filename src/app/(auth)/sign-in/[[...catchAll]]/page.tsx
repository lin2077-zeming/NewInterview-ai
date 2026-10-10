import { redirect } from "next/navigation";

// Coze 沙箱部署：无需 Clerk 认证，直接跳转首页
export default function SignInPage() {
  redirect("/");
}
