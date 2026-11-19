import { NextResponse } from "next/server";
import { assignMatch } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 운영자가 저장된 추천 하나로 후배와 선배를 직접 잇는다.
 *
 * 선배를 고르지 않은 후배를 운영자가 대신 이어 준다. 이은 뒤에는
 * "연결 알림" 탭에서 선배와 후배 모두에게 문자를 보낸다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다 — /api/admin/* 는 운영자 세션이
 * 있어야 통과하고, 보기 전용 계정은 막힌다.
 */

/** matchings.id 는 uuid 다. 다른 모양은 DB까지 보내지 않는다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  let matchingId: string;
  try {
    const body = (await request.json()) as { matchingId?: unknown };
    matchingId = String(body.matchingId ?? "");
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!UUID.test(matchingId)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await assignMatch(matchingId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "연결하지 못했어요." }, { status: 409 });
  }
  console.log(`[admin] 운영자 연결 — matching ${matchingId}`);
  return NextResponse.json({ ok: true });
}
