import { NextResponse } from "next/server";
import { deleteUser } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 운영자가 명단에서 한 사람을 지운다. 되돌릴 수 없다.
 *
 * 테스트 등록, 잘못 들어온 번호, 본인이 삭제를 요청한 경우(개인정보 삭제 요청)에 쓴다.
 * 프로필과 매칭은 DB 가 함께 지운다(repository.deleteUser).
 *
 * 접근 제어는 src/middleware.ts 가 담당한다 — /api/admin/* 는 운영자 세션이
 * 있어야 통과하고, 보기 전용 계정은 막힌다.
 */

/** users.id 는 uuid 다. 다른 모양은 DB까지 보내지 않는다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  let userId: string;
  try {
    const body = (await request.json()) as { userId?: unknown };
    userId = String(body.userId ?? "");
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!UUID.test(userId)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await deleteUser(userId);
  if (!result.ok) {
    return NextResponse.json({ error: "지우지 못했어요. 다시 눌러주세요." }, { status: 500 });
  }

  // 누가 지워졌는지는 참여코드로만 남긴다. 이름·연락처를 찍으면 로그가 개인정보 파일이 된다.
  console.log(`[admin] delete ${result.code ?? "(already gone)"}`);
  return NextResponse.json({ ok: true });
}
