import type { NextConfig } from "next";

/** Onde o Next encaminha `/api/*` no servidor (só a máquina do dev; o celular não precisa abrir a 3333). */
const BACKEND_PROXY_TARGET =
  process.env.BACKEND_PROXY_TARGET ?? "http://127.0.0.1:3333";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.54"],

  async rewrites() {
    const base = BACKEND_PROXY_TARGET.replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
