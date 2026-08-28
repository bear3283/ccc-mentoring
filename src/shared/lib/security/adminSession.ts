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

export async function createSessionValue(secret: string): Promise<string> {
  const expiresAt = String(Date.now() + SESSION_MS);
  return `${expiresAt}.${await sign(expiresAt, secret)}`;
}

export async function verifySessionValue(
  value: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!value) return false;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return false;

  const expiresAt = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  const expected = await sign(expiresAt, secret);
  if (!safeEqual(signature, expected)) return false;

  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && Date.now() < expiry;
}

/** 비밀번호 비교도 길이·내용을 한 번에 노출하지 않도록 상수 시간으로 한다. */
export function passwordMatches(input: string, expected: string): boolean {
  return safeEqual(input, expected);
}

export const SESSION_MAX_AGE_SECONDS = SESSION_MS / 1000;
