import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  type AdminRole,
  createSessionValue,
  passwordMatches,
  SESSION_MAX_AGE_SECONDS,
} from "@/shared/lib/security/adminSession";
import {
  clientKey,
  peekRateLimit,
  rateLimit,
  tooManyRequestsMessage,
} from "@/shared/lib/security/rateLimit";

/**
 * 비밀번호 무차별 대입을 막는다. **틀린 시도만** 센다.
 *
 * 예전에는 성공한 로그인도 세어(10회/10분), 행사장 Wi-Fi 처럼 IP 하나를 나눠 쓰는 곳에서
 * 봉사자·운영자 열 명이 차례로 들어오면 11번째부터 모두 막혔다. 같은 공간의 여러 사람이
 * 오타를 내는 것까지 받도록 넉넉히 두되, 비밀번호를 훑기에는 턱없이 모자란 수준으로 둔다.
 */
const MAX_FAILURES = 30;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const key = clientKey(request, "admin-login-failure");
  const limit = peekRateLimit(key, MAX_FAILURES);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(limit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  const expected = process.env.ADMIN_PASSWORD;
  if (!secret || !expected) {
    return NextResponse.json(
      { error: "운영자 비밀번호가 설정되지 않았습니다. .env.local 을 확인하세요." },
      { status: 503 },
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // 보기 전용 비밀번호는 선택이다. 설정하지 않았으면 운영자 비밀번호만 받는다.
  // 클립보드로 넣다가 끝에 줄바꿈이 딸려 들어오기 쉬워 앞뒤 공백은 떼고 비교한다.
  const viewer = process.env.VIEWER_PASSWORD?.trim();
  // 출석 전용 비밀번호도 선택이다. 채플 당일 입구 봉사자에게 준다.
  const checkin = process.env.CHECKIN_PASSWORD?.trim();
  const role: AdminRole | null = passwordMatches(password, expected)
    ? "admin"
    : viewer && passwordMatches(password, viewer)
      ? "viewer"
      : checkin && passwordMatches(password, checkin)
        ? "checkin"
        : null;

  if (!role) {
    rateLimit(key, MAX_FAILURES, WINDOW_MS);
    // 남은 시도 횟수를 알려주면 공격자에게도 정보가 되므로 알려주지 않는다.
    return NextResponse.json({ error: "비밀번호가 맞지 않아요." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(ADMIN_COOKIE, await createSessionValue(secret, role), {
    httpOnly: true, // 자바스크립트로 못 읽게 해 XSS로 탈취되는 것을 막는다
    sameSite: "lax", // 다른 사이트에서 넘어온 요청에는 쿠키를 싣지 않는다
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

/** 로그아웃 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
