import { NextResponse } from "next/server";
import { setMentorVerification, type VerificationAction } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 운영자가 선배의 캠퍼스 인증 상태를 바꾼다: verify(인증) · reject(미인증) · reset(확인 대기로).
 *
 * 흐름: 선배 신청 → 운영자 화면 "멘토 인증" 탭에서 캠퍼스별 명단을 뽑아 캠퍼스 리더에게
 * 보냄 → 실제 학생인지 확인받음 → 여기서 인증 → 그때부터 후배의 추천 후보가 된다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다 — /api/admin/* 는 운영자 세션이
 * 있어야 통과하고, 보기 전용 계정은 막힌다.
 */

/** users.id 는 uuid 다. 다른 모양은 DB까지 보내지 않는다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "모두 인증"으로 전체를 한 번에 처리할 수 있을 만큼. 잘못된 요청이 끝없이 커지지 않게 막는다. */
const MAX_IDS = 1000;

const ACTIONS: readonly VerificationAction[] = ["verify", "reject", "reset"];

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  let userIds: string[];
  let action: VerificationAction;
  try {
    const body = (await request.json()) as { userIds?: unknown; action?: unknown; verified?: unknown };
    userIds = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
    // action 이 없으면 예전 요청 모양(verified: true/false)으로 읽는다.
    action = ACTIONS.includes(body.action as VerificationAction)
      ? (body.action as VerificationAction)
      : body.verified === false
        ? "reset"
        : "verify";
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (userIds.length === 0 || userIds.length > MAX_IDS || !userIds.every((id) => UUID.test(id))) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await setMentorVerification(userIds, action);
  if (!result.ok) {
    return NextResponse.json({ error: "저장하지 못했어요. 다시 눌러주세요." }, { status: 500 });
  }

  return NextResponse.json({
    verifiedAt: result.verifiedAt ?? null,
    rejectedAt: result.rejectedAt ?? null,
    updated: result.updated ?? 0,
  });
}
