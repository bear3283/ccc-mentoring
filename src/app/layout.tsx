import type { Metadata, Viewport } from "next";
import { Bodoni_Moda } from "next/font/google";
import "./globals.css";

// 포스터의 RE:CHILL 과 같은 결의 세리프. 행사 이름 한 곳에만 쓰므로 라틴 글자만 받는다.
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bodoni",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CCC 멘토-멘티 매칭",
  description: "예비 대학생과 CCC 선배를 연결해주는 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 입력 폼에서 iOS가 자동으로 화면을 확대하는 것을 막는다.
  maximumScale: 1,
  viewportFit: "cover",
  // 주소창을 캔버스색(gray-100)과 맞춰 화면이 위로 끊기지 않게 한다.
  themeColor: "#f8efe6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={bodoni.variable}>
      <body>{children}</body>
    </html>
  );
}
