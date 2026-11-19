import { NextResponse } from "next/server";
import { setMentoringInvited } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 운영자가 등록만 한 고3에게 멘토링 신청 안내 문자를 보냈다고 기록한다.
 *
 * 문자는 운영자 휴대폰의 문자 앱이 보낸다. 서버는 보냈는지 알 수 없으므로
 * 운영자가 "보냄"을 눌러 기록한다. undo 는 잘못 누른 경우에만 쓴다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다.
 */

/** users.id 는 uuid 다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  let userId: string;
  let undo: boolean;
  try {
    const body = (await request.json()) as { userId?: unknown; undo?: unknown };
    userId = String(body.userId ?? "");
    undo = body.undo === true;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!UUID.test(userId)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await setMentoringInvited(userId, undo);
  if (!result.ok) {
    return NextResponse.json({ error: "기록하지 못했어요. 다시 눌러주세요." }, { status: 500 });
  }
  return NextResponse.json({ invitedAt: result.invitedAt ?? null });
}
