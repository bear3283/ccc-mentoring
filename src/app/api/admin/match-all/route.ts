import { NextResponse } from "next/server";
import { runMatchingForAll } from "@/features/signup/lib/repository";
import { isSupabaseConfigured } from "@/shared/lib/supabase/server";

/**
 * 멘토링 신청자 전원의 추천을 다시 계산한다.
 *
 * 추천은 원래 멘티가 결과 화면을 열 때 계산된다. 신청만 하고 화면을 안 본
 * 사람은 운영자 매칭 표에 나타나지 않아, 당일 짝 명단이 비게 된다.
 *
 * 짝을 정해 주지는 않는다. 추천만 만들고 선택은 멘티가 한다.
 * 이미 확정된 멘티는 건드리지 않는다.
 *
 * 접근 제어는 src/middleware.ts 가 담당한다 — /api/admin/* 는 운영자 세션이
 * 있어야 통과한다. 여기서 다시 확인하지 않는 이유는 지켜야 할 문을
 * 하나로 유지하기 위해서다.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "서버가 연결되지 않았어요." }, { status: 503 });
  }

  try {
    const result = await runMatchingForAll();
    console.log(
      `[admin] 전체 매칭 실행 — 대상 ${result.applicants} / 계산 ${result.computed}` +
        ` / 확정 유지 ${result.settled} / 후보 없음 ${result.noCandidates}`,
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[admin] 전체 매칭 실행 실패 —", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "매칭을 계산하지 못했어요. 로그를 확인해주세요." },
      { status: 500 },
    );
  }
}
