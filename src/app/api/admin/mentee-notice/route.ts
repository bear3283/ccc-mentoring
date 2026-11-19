import { NextResponse } from "next/server";
import { setMenteeNotified } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 운영자가 후배에게 연결 알림 문자를 보냈다고 기록한다.
 * 운영자가 이어 준 연결에만 쓴다(후배가 직접 고른 연결은 후배가 이미 번호를 봤다).
 *
 * 문자는 운영자 휴대폰의 문자 앱이 보낸다. 서버는 보냈는지 알 수 없으므로
 * 운영자가 "보냄"을 눌러 기록한다. undo 는 잘못 누른 경우에만 쓴다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다.
 */

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

  const result = await setMenteeNotified(matchingId, undo);
  if (!result.ok) {
    return NextResponse.json({ error: "기록하지 못했어요. 다시 눌러주세요." }, { status: 500 });
  }
  return NextResponse.json({ notifiedAt: result.notifiedAt ?? null });
}
