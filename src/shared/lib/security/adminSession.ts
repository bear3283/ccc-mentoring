/**
 * 운영자 세션.
 *
 * 로그인이 필요한 사용자는 운영자 한 부류뿐이라 사용자 테이블을 두지 않고,
 * 비밀번호가 맞으면 서명된 쿠키를 발급한다.
 *
 * 쿠키에는 "언제까지 유효한가"만 담고 HMAC으로 서명한다. 서버 비밀키를
 * 모르면 만료 시각을 늘려 위조할 수 없다.
 *
 * 미들웨어(Edge 런타임)에서도 검증해야 하므로 node:crypto가 아니라
 * Web Crypto API를 쓴다.
 */

export const ADMIN_COOKIE = "ccc_admin";

/**
 * 운영자(admin)는 모든 것을, 보기 전용(viewer)은 화면만 본다.
 * 보기 전용은 신청 현황을 함께 확인할 사람에게 주는 비밀번호(VIEWER_PASSWORD)로 들어온다.
 */
export type AdminRole = "admin" | "viewer";

/**
 * 보기 전용 세션은 만료 시각 앞에 이 표식을 붙여 함께 서명한다.
 * 운영자 쿠키 모양은 전과 같아서, 이미 로그인한 운영자는 다시 들어오지 않아도 된다.
 */
const VIEWER_PREFIX = "viewer:";

/** 세션 유효 기간. 현장에서 하루 종일 쓰는 화면이라 12시간으로 잡는다. */
const SESSION_MS = 12 * 60 * 60 * 1000;

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(mac));
}

/** 길이가 같은 두 문자열을 시간 차이 없이 비교한다. 타이밍 공격 방지. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionValue(
  secret: string,
  role: AdminRole = "admin",
): Promise<string> {
  const payload = `${role === "viewer" ? VIEWER_PREFIX : ""}${Date.now() + SESSION_MS}`;
  return `${payload}.${await sign(payload, secret)}`;
}

/** 서명과 만료를 확인하고 역할을 돌려준다. 유효하지 않으면 null. */
export async function verifySessionValue(
  value: string | undefined,
  secret: string,
): Promise<AdminRole | null> {
  if (!value || !secret) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  const expected = await sign(payload, secret);
  if (!safeEqual(signature, expected)) return null;

  // 표식도 서명 안에 있으므로 보기 전용 쿠키를 운영자 쿠키로 바꿔 쓸 수 없다.
  const role: AdminRole = payload.startsWith(VIEWER_PREFIX) ? "viewer" : "admin";
  const expiry = Number(payload.slice(role === "viewer" ? VIEWER_PREFIX.length : 0));
  return Number.isFinite(expiry) && Date.now() < expiry ? role : null;
}

/** 비밀번호 비교도 길이·내용을 한 번에 노출하지 않도록 상수 시간으로 한다. */
export function passwordMatches(input: string, expected: string): boolean {
  return safeEqual(input, expected);
}

export const SESSION_MAX_AGE_SECONDS = SESSION_MS / 1000;
