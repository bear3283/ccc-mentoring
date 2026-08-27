import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 개발용 인디케이터 배지가 화면 하단 CTA 위에 겹쳐 보여서 끈다.
  devIndicators: false,
};

export default nextConfig;
