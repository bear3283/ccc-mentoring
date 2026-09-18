import { getPersonaAffinity } from "@/shared/constants/persona";
import { buildHashtags } from "./hashtags";
import type { MatchResult, Mentee, Mentor, ScoreBreakdown } from "../model/types";

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
  campus: 40,
  /** 무엇을 도와주길 원하는가. 성향보다 실질적인 신호라 비중을 뒀다. */
  area: 20,
  /**
   * 만날 수 있는 시간이 얼마나 겹치는가.
   *
   * 예전에는 하나도 안 겹치면 후보에서 제외했다. 그러면 같은 캠퍼스에
   * 관심사까지 맞는 멘토가 시간 한 칸 때문에 통째로 사라져, 멘티는
   * "0명"만 보고 이유도 알 수 없었다. 일정은 조정할 수 있고 밤 시간대는
   * 온라인이라, 아예 배제하기보다 크게 깎는 편이 낫다.
   */
  schedule: 15,
  /** MBTI 4축 x 2.5점. 축 하나가 맞을 때마다 2.5점. */
  mbti: 10,
  majorAndCareer: 10,
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

/** WEIGHTS.majorAndCareer 안에서 학과와 진로가 나눠 갖는 비율. */
const MAJOR_RATIO = 0.6;
const CAREER_RATIO = 0.4;

/**
 * 지망 캠퍼스 (50점).
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
 * MBTI (10점 = 4축 x 2.5점).
 * 같은 글자면 2.5점, 다르면 0점.
 *
 * 한쪽이라도 MBTI를 안 적었으면 축마다 절반(1.25점)을 준다.
 * MBTI는 건너뛸 수 있는 항목이라 0점을 주면 안 적은 사람이
 * 모든 멘토에게서 10점을 통째로 잃는다. 무작위 조합의 기대값이
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
 * 학과 / 진로 (WEIGHTS.majorAndCareer).
 * 양쪽 다 최대 3개까지 고를 수 있으므로 교집합이 하나라도 있으면 인정한다.
 * 겹치는 개수가 많을수록 점수가 오르되, 하나만 겹쳐도 절반은 준다.
 */
function overlapScore(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const matched = a.filter((x) => b.includes(x)).length;
  if (matched === 0) return 0;
  // 1개 겹침 = 0.5, 전부 겹침 = 1.0
  return 0.5 + 0.5 * (matched / Math.min(a.length, b.length));
}

export function scoreMajorAndCareer(mentee: Mentee, mentor: Mentor): number {
  const majorScore =
    WEIGHTS.majorAndCareer * MAJOR_RATIO * overlapScore(mentee.targetMajors, mentor.currentMajors);
  const careerScore =
    WEIGHTS.majorAndCareer * CAREER_RATIO * overlapScore(mentee.targetCareers, mentor.careerPaths);
  return majorScore + careerScore;
}

/**
 * 시간대 (WEIGHTS.schedule).
 *
 * 멘티가 고른 시간 중 몇 개가 겹치는지의 비율.
 * 하나도 안 겹치면 0점이지만 후보에서 빠지지는 않는다.
 *
 * 성별은 점수에 넣지 않는다. 예전에는 1.5점을 줬는데 순위를 바꾼 적이
 * 사실상 없었고, 멘토링 상대를 성별로 가점하는 것 자체가 적절하지 않다.
 */
export function scoreSchedule(mentee: Mentee, mentor: Mentor): number {
  if (mentee.availableTimes.length === 0) return 0;
  const overlap = mentee.availableTimes.filter((t) => mentor.availableTimes.includes(t));
  return WEIGHTS.schedule * (overlap.length / mentee.availableTimes.length);
}

/** 겹치는 시간이 하나도 없는지. 카드에 경고를 띄울 때 쓴다. */
export function hasNoTimeOverlap(mentee: Mentee, mentor: Mentor): boolean {
  return !mentee.availableTimes.some((t) => mentor.availableTimes.includes(t));
}

/**
 * 필수 필터. 하나라도 걸리면 후보에서 제외한다.
 * 점수를 깎는 게 아니라 아예 제외하는 이유: 만날 수 없는 멘토는
 * 아무리 성향이 잘 맞아도 매칭의 의미가 없다.
 */
export function passesRequiredFilters(mentee: Mentee, mentor: Mentor): boolean {
  // 연락처가 없으면 매칭돼도 연결할 방법이 없다.
  if (!mentor.contact || !mentee.contact) return false;

  // 지망 캠퍼스는 멘티가 직접 고른 조건이라 그대로 지킨다.
  // 시간대와 달리 조정할 수 있는 값이 아니다.
  if (!mentee.targetCampus.includes(mentor.currentCampus)) return false;

  return true;
}

export function calculateBreakdown(mentee: Mentee, mentor: Mentor): ScoreBreakdown {
  return {
    campus: scoreCampus(mentee, mentor),
    area: scoreArea(mentee, mentor),
    schedule: scoreSchedule(mentee, mentor),
    mbti: scoreMbti(mentee, mentor),
    majorAndCareer: scoreMajorAndCareer(mentee, mentor),
    persona: scorePersona(mentee, mentor),
  };
}

/** 항목 점수를 모두 더한다. 항목이 늘어도 여기만 고치면 된다. */
export function totalScore(breakdown: ScoreBreakdown): number {
  return Object.values(breakdown).reduce((sum, value) => sum + value, 0);
}

/**
 * 멘티 한 명에 대해 전체 멘토를 점수화하고 높은 순으로 정렬한다.
 * @param limit 상위 몇 명까지 돌려줄지. 결과 카드 화면에 그대로 쓴다.
 */
export function matchMentors(mentee: Mentee, mentors: Mentor[], limit = 5): MatchResult[] {
  return mentors
    .filter((mentor) => passesRequiredFilters(mentee, mentor))
    .map((mentor) => {
      const breakdown = calculateBreakdown(mentee, mentor);

      return {
        mentor,
        score: Math.round(totalScore(breakdown)),
        breakdown,
        hashtags: buildHashtags(mentor, mentee),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
