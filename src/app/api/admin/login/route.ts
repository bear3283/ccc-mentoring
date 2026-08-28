import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createSessionValue,
  passwordMatches,
  SESSION_MAX_AGE_SECONDS,
} from "@/shared/lib/security/adminSession";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";

/** 비밀번호 무차별 대입을 막는다. 사람이 오타를 내는 횟수보다는 넉넉하게. */
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "admin-login"), MAX_ATTEMPTS, WINDOW_MS);
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

  if (!passwordMatches(password, expected)) {
    // 남은 시도 횟수를 알려주면 공격자에게도 정보가 되므로 알려주지 않는다.
    return NextResponse.json({ error: "비밀번호가 맞지 않아요." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await createSessionValue(secret), {
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
