import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionValue } from "@/shared/lib/security/adminSession";

/**
 * 운영자 화면과 운영자 API를 잠근다.
 *
 * 이 화면에는 신청자 1,300명의 이름·연락처가 그대로 보인다.
 * 주소만 알면 열리는 상태로 두면 안 되므로 요청이 라우트에 닿기 전에 막는다.
 */
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 화면과 로그인 처리는 당연히 열려 있어야 한다.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  const password = process.env.ADMIN_PASSWORD;

  // 비밀번호를 설정하지 않았으면 아무도 못 들어가게 한다.
  // "설정 안 했으니 통과"로 두면 배포 후 그대로 열려 있게 된다.
  if (!secret || !password) {
    return respondLocked(request, "not-configured");
  }

  const role = await verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value, secret);
  if (!role) return respondLocked(request, "unauthorized");

  // 보기 전용은 화면만 본다. 운영자 API는 모두 무언가를 바꾸므로 여기서 막는다.
  // 화면에서 버튼을 숨기는 것만으로는 직접 보낸 요청을 막지 못한다.
  if (role === "viewer" && pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "보기 전용 계정은 바꿀 수 없어요." }, { status: 403 });
  }

  return NextResponse.next();
}

function respondLocked(request: NextRequest, reason: string) {
  // API는 리다이렉트가 아니라 상태 코드로 답해야 호출부가 처리할 수 있다.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: reason === "not-configured" ? "운영자 비밀번호가 설정되지 않았습니다." : "로그인이 필요합니다." },
      { status: reason === "not-configured" ? 503 : 401 },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("reason", reason);
  // 로그인 후 원래 가려던 곳으로 돌려보낸다.
  if (request.nextUrl.pathname !== "/admin") {
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}
