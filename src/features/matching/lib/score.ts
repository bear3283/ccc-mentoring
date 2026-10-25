import { regionOf } from "@/shared/constants/campus";
import { getPersonaAffinity } from "@/shared/constants/persona";
import { buildHashtags } from "./hashtags";
import type { FallbackReason, MatchResult, Mentee, Mentor, ScoreBreakdown } from "../model/types";

/**
 * 가중치. 합계는 항상 100이어야 한다.
 * 운영하면서 반드시 조정하게 되므로 한곳에 모아 두고, 점수 계산은 순수 함수로 유지한다.
 */
export const WEIGHTS = {
  /**
   * 지망 순위까지 반영한다.
   * 캠퍼스는 필수 필터이기도 해서, 지망 밖 멘토는 이미 후보에서 빠진다.
   * 이 점수가 가르는 것은 "1지망이냐 3지망이냐"뿐이다.
   */
  campus: 35,
  /**
   * 무엇을 도와주길 원하는가. 성향보다 실질적인 신호라 비중을 뒀다.
   *
   * 예전에는 멘토링 가능 시간대(10점)도 봤다. 1:1 멘토링 날짜를 매칭 뒤
   * 문자로 정하기로 하면서 시간대를 묻지 않게 되어, 그 10점을 영역과
   * 학과에 5점씩 나눴다.
   */
  area: 30,
  /** MBTI 4축 x 1.25점. 성경 인물과 같은 보조 지표라 같은 비중이다. */
  mbti: 5,
  /** 고3이 실제로 묻고 싶은 것은 "그 학과 생활"이라 분야 다음으로 무겁게 둔다. */
  major: 25,
  /** 성경 인물 성향. MBTI와 역할이 겹치므로 보조 지표로 둔다. */
  persona: 5,
} as const;

/** 가중치 총합. 검증 스크립트가 100인지 확인한다. */
export const WEIGHT_TOTAL = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);

/**
 * 수집하지만 점수에는 넣지 않기로 한 항목.
 *
 * highSchool: 출신 고등학교는 지금 사실 확인할 방법이 없다. 적어 낸 값을 그대로
 *   믿고 점수를 주면 표기 차이("한빛고" vs "한빛고등학교")나 오타만으로 순위가
 *   흔들린다. 수집해서 운영자 표에 보여 주기만 하고 매칭에는 쓰지 않는다.
 * referrer: 추천인도 같은 이유로 참고용이다.
 *
 * 나중에 반영하려면:
 *   1) WEIGHTS에 항목을 추가하고 다른 항목을 그만큼 줄여 합계 100을 유지한다.
 *   2) scoreXxx 순수 함수를 하나 만들어 calculateBreakdown에 더한다.
 *   3) ScoreBreakdown 타입에 같은 키를 넣어야 점수 근거가 화면에 드러난다.
 */
export const UNSCORED_FIELDS = ["highSchool", "referrer"] as const;


/**
 * 지망 캠퍼스 (WEIGHTS.campus).
 * 1지망 100%, 2지망 80%, 3지망 60%. 지망 순서를 반영해야
 * 1지망이 맞는 멘토가 3지망만 맞는 멘토보다 확실히 위로 온다.
 */
const CAMPUS_RANK_RATIO = [1, 0.8, 0.6];

export function scoreCampus(mentee: Mentee, mentor: Mentor): number {
  const rank = mentee.targetCampus.indexOf(mentor.currentCampus);
  if (rank === -1) return 0;
  return WEIGHTS.campus * (CAMPUS_RANK_RATIO[rank] ?? 0.6);
}

/**
 * 원하는 영역 (WEIGHTS.area).
 * 멘티가 여러 영역을 고를 수 있으므로 "몇 개나 겹치는가"의 비율로 계산한다.
 * 3개 중 3개가 맞는 멘토가 1개만 맞는 멘토보다 위로 와야 한다.
 */
export function scoreArea(mentee: Mentee, mentor: Mentor): number {
  if (mentee.desiredAreas.length === 0) return 0;
  const matched = mentee.desiredAreas.filter((a) => mentor.mentoringArea.includes(a));
  return WEIGHTS.area * (matched.length / mentee.desiredAreas.length);
}

/**
 * 성경 인물 성향 (5점).
 * 완전 불일치에도 0을 주지 않는다. 캠퍼스가 잘 맞는 멘토가
 * 성향 하나 때문에 후보에서 밀리면 안 된다.
 */
export function scorePersona(mentee: Mentee, mentor: Mentor): number {
  return WEIGHTS.persona * getPersonaAffinity(mentee.personaType, mentor.personaType);
}

/** MBTI 4축. 축 하나당 배점. */
const MBTI_AXIS_COUNT = 4;
const POINTS_PER_AXIS = WEIGHTS.mbti / MBTI_AXIS_COUNT;

/**
 * MBTI (WEIGHTS.mbti = 4축 x 축당 점수).
 * 같은 글자면 축당 점수, 다르면 0점.
 *
 * 한쪽이라도 MBTI를 안 적었으면 축마다 절반을 준다.
 * MBTI는 건너뛸 수 있는 항목이라 0점을 주면 안 적은 사람이
 * 모든 멘토에게서 MBTI 점수를 통째로 잃는다. 무작위 조합의 기대값이
 * 축당 절반이므로, 절반을 주면 유불리 없이 중립이 된다.
 */
export function scoreMbti(mentee: Mentee, mentor: Mentor): number {
  if (!mentee.mbti || !mentor.mbti) {
    return WEIGHTS.mbti / 2;
  }

  let score = 0;
  for (let axis = 0; axis < MBTI_AXIS_COUNT; axis++) {
    if (mentee.mbti[axis] === mentor.mbti[axis]) score += POINTS_PER_AXIS;
  }
  return score;
}

/**
 * 학과 (WEIGHTS.major).
 * 양쪽 다 최대 3개까지 고를 수 있으므로 교집합이 하나라도 있으면 인정한다.
 * 하나만 겹쳐도 절반 이상을 주고, 적게 고른 쪽의 학과가 모두 겹치면 만점이다.
 *
 * 예전에는 희망 진로도 함께 봤다(학과 6 : 진로 4). 진로를 묻지 않게 되면서
 * 학과만 남았다.
 */
function overlapScore(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const matched = a.filter((x) => b.includes(x)).length;
  if (matched === 0) return 0;
  // 적게 고른 쪽 기준으로 비율을 본다. 그쪽이 고른 것이 모두 겹치면 1.0,
  // 3개 중 1개만 겹치면 0.5 + 0.5 × 1/3 ≈ 0.67.
  return 0.5 + 0.5 * (matched / Math.min(a.length, b.length));
}

export function scoreMajor(mentee: Mentee, mentor: Mentor): number {
  return WEIGHTS.major * overlapScore(mentee.targetMajors, mentor.currentMajors);
}

/**
 * 같은 성별인지. 매칭은 같은 성별끼리만 한다.
 *
 * 성별이 비어 있으면(성별을 받기 전에 등록한 사람) 같다고 볼 수 없어 제외한다.
 * 그런 사람은 멘토링 신청 화면에서 성별을 고르고 다시 내면 후보가 된다.
 * 점수로 가점하지 않고 필터로만 쓴다.
 */
export function isSameGender(
  mentee: Pick<Mentee, "gender">,
  mentor: Pick<Mentor, "gender">,
): boolean {
  return !!mentee.gender && mentee.gender === mentor.gender;
}

/**
 * 필수 필터. 하나라도 걸리면 후보에서 제외한다.
 * 점수를 깎는 게 아니라 아예 제외하는 이유: 만날 수 없는 멘토는
 * 아무리 성향이 잘 맞아도 매칭의 의미가 없다.
 */
export function passesRequiredFilters(mentee: Mentee, mentor: Mentor): boolean {
  // 연락처가 없으면 매칭돼도 연결할 방법이 없다.
  if (!mentor.contact || !mentee.contact) return false;

  if (!isSameGender(mentee, mentor)) return false;

  // 지망 캠퍼스는 멘티가 직접 고른 조건이라 그대로 지킨다.
  if (!mentee.targetCampus.includes(mentor.currentCampus)) return false;

  return true;
}

export function calculateBreakdown(mentee: Mentee, mentor: Mentor): ScoreBreakdown {
  return {
    campus: scoreCampus(mentee, mentor),
    area: scoreArea(mentee, mentor),
    mbti: scoreMbti(mentee, mentor),
    major: scoreMajor(mentee, mentor),
    persona: scorePersona(mentee, mentor),
  };
}

/** 항목 점수를 모두 더한다. 항목이 늘어도 여기만 고치면 된다. */
export function totalScore(breakdown: ScoreBreakdown): number {
  return Object.values(breakdown).reduce((sum, value) => sum + value, 0);
}

function toResult(mentee: Mentee, mentor: Mentor, fallback?: FallbackReason): MatchResult {
  const breakdown = calculateBreakdown(mentee, mentor);
  return {
    mentor,
    score: Math.round(totalScore(breakdown)),
    breakdown,
    hashtags: buildHashtags(mentor, mentee),
    ...(fallback && { fallback }),
  };
}

/**
 * 멘티 한 명에 대해 전체 멘토를 점수화하고 높은 순으로 정렬한다.
 * @param limit 상위 몇 명까지 돌려줄지. 결과 카드 화면에 그대로 쓴다.
 */
export function matchMentors(mentee: Mentee, mentors: Mentor[], limit = 5): MatchResult[] {
  return mentors
    .filter((mentor) => passesRequiredFilters(mentee, mentor))
    .map((mentor) => toResult(mentee, mentor))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 지망 캠퍼스 밖의 선배를 왜 보여주는지. 지망 캠퍼스 안의 선배면 undefined.
 *
 * 학과가 지역보다 앞선다. 고3에게 "그 학과 생활이 어떤지"는 학교가 달라도
 * 그대로 통하는 이야기지만, 같은 지역이라는 것은 만나기 쉽다는 것 말고는
 * 전해 줄 것이 적다.
 */
export function fallbackReason(
  mentee: Pick<Mentee, "targetCampus" | "targetMajors">,
  mentor: Pick<Mentor, "currentCampus" | "currentMajors">,
): FallbackReason | undefined {
  if (mentee.targetCampus.includes(mentor.currentCampus)) return undefined;
  if (mentor.currentMajors.some((m) => mentee.targetMajors.includes(m))) return "MAJOR";

  const region = regionOf(mentor.currentCampus);
  if (region && mentee.targetCampus.some((c) => regionOf(c) === region)) return "REGION";

  return undefined;
}

const FALLBACK_ORDER: Record<FallbackReason, number> = { MAJOR: 0, REGION: 1 };

/**
 * 지망 캠퍼스에 선배가 한 명도 없을 때 대신 보여줄 선배.
 *
 * 캠퍼스 필터를 몰래 푸는 것이 아니다. 결과 화면은 이들을 "지망 캠퍼스 밖"이라고
 * 밝혀서 보여주고, 고를지는 멘티가 정한다. 캠퍼스 점수가 0이라 적합도가 낮게
 * 나오므로, 같은 이유끼리만 점수로 줄을 세우고 이유는 학과 → 지역 순으로 둔다.
 */
export function matchFallbackMentors(
  mentee: Mentee,
  mentors: Mentor[],
  limit = 5,
): MatchResult[] {
  return mentors
    // 연락처·성별 확인은 대체 후보라고 건너뛸 수 없다.
    .filter((mentor) => mentor.contact && mentee.contact && isSameGender(mentee, mentor))
    .flatMap((mentor) => {
      const reason = fallbackReason(mentee, mentor);
      return reason ? [toResult(mentee, mentor, reason)] : [];
    })
    .sort(
      (a, b) =>
        FALLBACK_ORDER[a.fallback!] - FALLBACK_ORDER[b.fallback!] || b.score - a.score,
    )
    .slice(0, limit);
}

/**
 * 멘티에게 보여줄 추천. 지망 캠퍼스 안에서 먼저 찾고, 한 명도 없을 때만
 * 대체 후보로 넘어간다. 지망 캠퍼스 선배가 한 명이라도 있으면 그쪽이 우선이다.
 */
export function recommendMentors(mentee: Mentee, mentors: Mentor[], limit = 5): MatchResult[] {
  const primary = matchMentors(mentee, mentors, limit);
  return primary.length > 0 ? primary : matchFallbackMentors(mentee, mentors, limit);
}
