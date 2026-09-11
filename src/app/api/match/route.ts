import { NextResponse } from "next/server";
import {
  findMenteeByCode,
  findSettledMatch,
  listAvailableMentors,
  saveMatchings,
} from "@/features/signup/lib/repository";
import { hasNoTimeOverlap, matchMentors } from "@/features/matching/lib/score";
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

  // 이미 매칭을 마쳤으면 재계산하지 않는다.
  // 후보 목록에서 자기 멘토가 빠져 있어 다시 계산하면 사라져 버린다.
  const settled = await findSettledMatch(mentee.id);

  // 이미 배정된 멘토는 빼고 계산한다. 매칭은 1:1이다.
  const mentors = await listAvailableMentors();
  const results = settled
    ? [
        {
          mentor: settled.mentor,
          score: settled.score,
          breakdown: settled.breakdown as ReturnType<typeof matchMentors>[number]["breakdown"],
          hashtags: matchMentors(mentee, [settled.mentor], 1)[0]?.hashtags ?? [],
        },
      ]
    : matchMentors(mentee, mentors, TOP_N);

  // 결과가 적거나 없을 때 "왜 그런지"를 함께 보낸다.
  const inCampus = mentors.filter((m) => mentee.targetCampus.includes(m.currentCampus));
  const diagnosis = {
    inTargetCampus: inCampus.length,
    noTimeOverlap: inCampus.filter((m) => hasNoTimeOverlap(mentee, m)).length,
    totalMentors: mentors.length,
    emptyCampuses: mentee.targetCampus.filter(
      (campus) => !mentors.some((m) => m.currentCampus === campus),
    ),
  };

  // 계산 결과를 남겨 두면 운영자가 나중에 같은 순위를 다시 볼 수 있다.
  if (!settled)
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
    diagnosis,
    // 이미 매칭을 마친 멘티에게는 그 한 명만 보여준다.
    settledMentorId: settled?.mentor.id,
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
      noTimeOverlap: hasNoTimeOverlap(mentee, r.mentor),
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
