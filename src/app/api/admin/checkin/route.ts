import { NextResponse } from "next/server";
import { searchForCheckIn, setAttended } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 채플 당일 입구 출석 체크.
 *
 * GET  ?q=   참여코드(정확히) 또는 이름 일부로 찾는다.
 * POST       { userId, undo? } 출석을 찍는다. undo 는 잘못 누른 경우에만 쓴다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다 — 운영자 세션이 있어야 하고,
 * 보기 전용 계정은 막힌다. 참가자가 스스로 찍는 통로는 두지 않는다:
 * 코드만 알면 현장에 없어도 출석이 되기 때문이다.
 */

/** users.id 는 uuid 다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 30);
  if (!q) return NextResponse.json({ people: [], truncated: false });

  const result = await searchForCheckIn(q);
  if (!result) {
    return NextResponse.json({ error: "찾지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }
  return NextResponse.json(result);
}

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

  const result = await setAttended(userId, undo);
  if (!result.ok) {
    return NextResponse.json({ error: "기록하지 못했어요. 다시 눌러주세요." }, { status: 500 });
  }
  if (!result.found) {
    return NextResponse.json({ error: "명단에 없는 사람이에요. 새로고침해주세요." }, { status: 404 });
  }
  return NextResponse.json({ attendedAt: result.attendedAt ?? null });
}
