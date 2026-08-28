import { NextResponse } from "next/server";
import { findMenteeByCode, listMentors, saveMatchings } from "@/features/signup/lib/repository";
import { matchMentors } from "@/features/matching/lib/score";
import { normalizeParticipationCode, isValidParticipationCode } from "@/features/onboarding/lib/participationCode";
import { maskContact } from "@/shared/lib/security/mask";
import { clientKey, rateLimit, tooManyRequestsMessage } from "@/shared/lib/security/rateLimit";

/**
 * 매칭 계산.
 *
 * 이 라우트가 존재하는 이유는 성능이 아니라 개인정보다.
 * 브라우저에서 매칭하려면 멘토 1,000명의 이름·연락처를 전부 내려받아야 하고,
 * 그러면 개발자도구만 열어도 전원 명단이 보인다.
 * 서버에서 계산해 상위 3명만, 그것도 연락처는 가려서 돌려준다.
 */

const TOP_N = 3;

/** 코드를 바꿔가며 남의 매칭 결과를 훑는 것을 막는다. */
const MAX_REQUESTS = 20;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "match"), MAX_REQUESTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: tooManyRequestsMessage(limit.retryAfterSeconds) },
      { status: 429 },
    );
  }

  let code: string;
  try {
    const body = (await request.json()) as { participationCode?: unknown };
    code = normalizeParticipationCode(String(body.participationCode ?? ""));
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!isValidParticipationCode(code)) {
    return NextResponse.json({ error: "참여코드를 확인해주세요." }, { status: 400 });
  }

  const mentee = await findMenteeByCode(code);
  if (!mentee) {
    return NextResponse.json({ error: "신청 내역을 찾지 못했어요." }, { status: 404 });
  }

  const mentors = await listMentors();
  const results = matchMentors(mentee, mentors, TOP_N);

  // 계산 결과를 남겨 두면 운영자가 나중에 같은 순위를 다시 볼 수 있다.
  await saveMatchings(
    mentee.id,
    results.map((r, i) => ({
      mentorId: r.mentor.id,
      score: r.score,
      breakdown: r.breakdown,
      rank: i + 1,
    })),
  );

  return NextResponse.json({
    mentee: {
      name: mentee.name,
      participationCode: mentee.participationCode,
      targetCampus: mentee.targetCampus,
      desiredAreas: mentee.desiredAreas,
      personaType: mentee.personaType,
    },
    results: results.map((r) => ({
      score: r.score,
      hashtags: r.hashtags,
      mentor: {
        id: r.mentor.id,
        name: r.mentor.name,
        currentCampus: r.mentor.currentCampus,
        currentMajors: r.mentor.currentMajors,
        admissionYear: r.mentor.admissionYear,
        careerPaths: r.mentor.careerPaths,
        mentoringArea: r.mentor.mentoringArea,
        personaType: r.mentor.personaType,
        mbti: r.mentor.mbti,
        photoUrl: r.mentor.photoUrl,
        availableTimes: r.mentor.availableTimes,
        // 연락처는 가린 값만 보낸다.
        // 전체 번호는 멘티가 '매칭하기'를 눌러 요청한 뒤에 공개한다.
        maskedContact: maskContact(r.mentor.contact),
      },
    })),
  });
}
