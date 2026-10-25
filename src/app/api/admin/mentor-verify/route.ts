import { NextResponse } from "next/server";
import { setMentorVerified } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 운영자가 선배의 캠퍼스를 인증하거나 인증을 거둔다.
 *
 * 흐름: 선배 신청 → 운영자 화면 "멘토 인증" 탭에서 캠퍼스별 명단을 뽑아 캠퍼스 리더에게
 * 보냄 → 실제 학생인지 확인받음 → 여기서 인증 → 그때부터 후배의 추천 후보가 된다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다 — /api/admin/* 는 운영자 세션이
 * 있어야 통과하고, 보기 전용 계정은 막힌다.
 */

/** users.id 는 uuid 다. 다른 모양은 DB까지 보내지 않는다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 한 캠퍼스를 한꺼번에 인증하는 정도면 충분하다. 잘못된 요청이 표 전체를 바꾸지 않게 막는다. */
const MAX_IDS = 200;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  let userIds: string[];
  let verified: boolean;
  try {
    const body = (await request.json()) as { userIds?: unknown; verified?: unknown };
    userIds = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
    verified = body.verified !== false;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (userIds.length === 0 || userIds.length > MAX_IDS || !userIds.every((id) => UUID.test(id))) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await setMentorVerified(userIds, verified);
  if (!result.ok) {
    return NextResponse.json({ error: "저장하지 못했어요. 다시 눌러주세요." }, { status: 500 });
  }

  return NextResponse.json({ verifiedAt: result.verifiedAt ?? null, updated: result.updated ?? 0 });
}
