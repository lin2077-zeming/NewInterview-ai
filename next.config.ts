import type { NextConfig } from "next";
import os from "node:os";

const localIpv4Hosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((item): item is os.NetworkInterfaceInfo => Boolean(item))
  .filter((item) => item.family === "IPv4" && !item.internal)
  .map((item) => item.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localIpv4Hosts],
  // PDF / DOCX 解析库依赖运行时资源，交给 Node 直接加载，避免打包器内联
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
