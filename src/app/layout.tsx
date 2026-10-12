import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/layout/Navbar";
import { OfflineNotice } from "@/components/layout/OfflineNotice";
import { StudioEntry } from "@/components/layout/StudioEntry";
import "./globals.css";

export const metadata: Metadata = {
  title: "职镜 OPC - AI 模拟面试",
  description: "模拟大厂真实面试 × 反转视角训练 × 深度复盘报告",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Navbar />
          {/* 未配置 AI 密钥时出现，说清还能用什么 */}
          <OfflineNotice />
          <main className="flex-1">{children}</main>
          {/* OPC 运营看板是评委核验用的内部工具，只在右下角留小入口 */}
          <StudioEntry />
        </ThemeProvider>
      </body>
    </html>
  );
}
