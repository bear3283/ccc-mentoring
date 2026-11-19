import { NextResponse } from "next/server";
import { isSameGender } from "@/features/matching/lib/score";
import { listAvailableMentors } from "@/features/signup/lib/repository";
import { GENDERS, type Gender } from "@/shared/constants/domain";

/**
 * 고3이 멘토링을 신청하기 전에 "어느 학교 선배가 몇 명 기다리는지"를 보여준다.
 *
 * "멘토링"이라는 말만으로는 무엇을 받는지 와닿지 않는다. 실제로 이어질 수 있는
 * 선배 수를 보여주면 신청할 이유가 생긴다(2026-11-19, 신청률을 올리려는 시도).
 *
 * 같은 성별끼리만 이어지므로 성별별로 센다. 인증을 마치고 자리가 남은 선배만 센다 —
 * 이어질 수 없는 선배까지 세면 신청한 뒤 실망한다.
 *
 * 숫자만 내보낸다. 이름·연락처는 없다. 로그인 없이 부르는 공개 주소다.
 */

export interface SeniorPreview {
  total: number;
  /** 선배가 많은 학교부터. */
  campuses: { campus: string; count: number }[];
}

/**
 * 등록 완료 화면마다 전체 선배 목록을 읽으면 DB가 무거워진다.
 * 1분 동안은 같은 값을 돌려준다(서버 인스턴스마다 따로 둔다).
 */
const CACHE_MS = 60_000;
let cached: { at: number; byGender: Record<Gender, SeniorPreview> } | undefined;

async function load(): Promise<Record<Gender, SeniorPreview>> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.byGender;

  const mentors = await listAvailableMentors();
  const byGender = Object.fromEntries(
    GENDERS.map((gender) => {
      const counts = new Map<string, number>();
      for (const m of mentors) {
        if (!isSameGender({ gender }, m) || !m.currentCampus) continue;
        counts.set(m.currentCampus, (counts.get(m.currentCampus) ?? 0) + 1);
      }
      const campuses = [...counts]
        .map(([campus, count]) => ({ campus, count }))
        .sort((a, b) => b.count - a.count || a.campus.localeCompare(b.campus, "ko"));
      return [gender, { total: campuses.reduce((sum, c) => sum + c.count, 0), campuses }];
    }),
  ) as Record<Gender, SeniorPreview>;

  cached = { at: Date.now(), byGender };
  return byGender;
}

export async function GET(request: Request) {
  const gender = new URL(request.url).searchParams.get("gender");
  if (!gender || !(GENDERS as readonly string[]).includes(gender)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const byGender = await load();
  return NextResponse.json(byGender[gender as Gender], {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" },
  });
}
