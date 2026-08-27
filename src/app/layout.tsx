import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCC 멘토-멘티 매칭",
  description: "예비 대학생과 CCC 선배를 캠퍼스·관심 영역·성향으로 이어주는 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 입력 폼에서 iOS가 자동으로 화면을 확대하는 것을 막는다.
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
