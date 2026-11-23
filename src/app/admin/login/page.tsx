import { LoginForm } from "@/features/admin/components/LoginForm";

/**
 * 운영자 로그인.
 *
 * 주소 값을 서버에서 읽어 폼을 처음 HTML 에 바로 그린다. 자바스크립트가 늦게 붙는
 * 브라우저(카카오톡 안 브라우저, 느린 현장 인터넷)에서도 비밀번호 칸이 바로 보인다.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  return <LoginForm next={first(params.next)} notConfigured={first(params.reason) === "not-configured"} />;
}
