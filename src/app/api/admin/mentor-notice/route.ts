import { NextResponse } from "next/server";
import { setMentorNotified } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 운영자가 선배에게 매칭 알림 문자를 보냈다고 기록한다.
 *
 * 문자는 운영자 휴대폰의 문자 앱이 보낸다. 서버는 보냈는지 알 수 없으므로
 * 운영자가 "보냄"을 눌러 기록한다. undo 는 잘못 누른 경우에만 쓴다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다 — /api/admin/* 는 운영자 세션이
 * 있어야 통과한다.
 */

/** matchings.id 는 uuid 다. 다른 모양은 DB까지 보내지 않는다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  let matchingId: string;
  let undo: boolean;
  try {
    const body = (await request.json()) as { matchingId?: unknown; undo?: unknown };
    matchingId = String(body.matchingId ?? "");
    undo = body.undo === true;
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!UUID.test(matchingId)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await setMentorNotified(matchingId, undo ? null : "ADMIN_SMS");
  if (!result.ok) {
    return NextResponse.json({ error: "기록하지 못했어요. 다시 눌러주세요." }, { status: 500 });
  }

  return NextResponse.json({ notifiedAt: result.notifiedAt ?? null });
}
