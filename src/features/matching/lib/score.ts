import { getPersonaAffinity, PERSONAS } from "@/shared/constants/persona";
import type { MatchResult, Mentee, Mentor, ScoreBreakdown } from "../model/types";

/**
 * 가중치. 합계는 항상 100이어야 한다.
 * 운영하면서 반드시 조정하게 되므로 한곳에 모아 두고, 점수 계산은 순수 함수로 유지한다.
 */
export const WEIGHTS = {
  campus: 50,
  areaAndPersona: 30,
  majorAndCareer: 15,
  basics: 5,
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

/** 2순위 30% 안에서 영역과 성향이 나눠 갖는 비율. */
const AREA_RATIO = 0.6;
const PERSONA_RATIO = 0.4;

/** 3순위 15% 안에서 학과와 진로가 나눠 갖는 비율. */
const MAJOR_RATIO = 0.6;
const CAREER_RATIO = 0.4;

/**
 * 1순위 (50%): 지망 캠퍼스 일치.
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
 * 2순위 (30%): 원하는 영역 + 성경 인물 성향.
 * 멘티가 여러 영역을 고를 수 있으므로 "몇 개나 겹치는가"의 비율로 계산한다.
 * 3개 중 3개가 맞는 멘토가 1개만 맞는 멘토보다 위로 와야 한다.
 */
export function scoreAreaAndPersona(mentee: Mentee, mentor: Mentor): number {
  const matched = mentee.desiredAreas.filter((a) => mentor.mentoringArea.includes(a));
  const areaRatio =
    mentee.desiredAreas.length === 0 ? 0 : matched.length / mentee.desiredAreas.length;
  const areaScore = WEIGHTS.areaAndPersona * AREA_RATIO * areaRatio;

  const affinity = getPersonaAffinity(mentee.personaType, mentor.personaType);
  const personaScore = WEIGHTS.areaAndPersona * PERSONA_RATIO * affinity;

  return areaScore + personaScore;
}

/**
 * 3순위 (15%): 학과 / 진로 일치.
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
 * 4순위 (5%): 시간대가 얼마나 넉넉히 겹치는지 + 동성 여부.
 * 시간대 겹침 자체는 아래 필수 필터에서 이미 걸러지므로,
 * 여기서는 "겹치는 슬롯이 많을수록 만나기 쉽다"를 점수화한다.
 */
export function scoreBasics(mentee: Mentee, mentor: Mentor): number {
  const overlap = mentee.availableTimes.filter((t) => mentor.availableTimes.includes(t));
  const overlapRatio =
    mentee.availableTimes.length === 0 ? 0 : overlap.length / mentee.availableTimes.length;

  const sameGender = mentee.gender === mentor.gender ? 1 : 0;

  return WEIGHTS.basics * (overlapRatio * 0.7 + sameGender * 0.3);
}

/**
 * 필수 필터. 하나라도 걸리면 후보에서 제외한다.
 * 점수를 깎는 게 아니라 아예 제외하는 이유: 만날 수 없는 멘토는
 * 아무리 성향이 잘 맞아도 매칭의 의미가 없다.
 */
export function passesRequiredFilters(mentee: Mentee, mentor: Mentor): boolean {
  // 연락처가 없으면 매칭돼도 연결할 방법이 없다.
  if (!mentor.contact || !mentee.contact) return false;

  // 참여 가능 시간대가 하나도 겹치지 않으면 만날 수 없다.
  const hasOverlap = mentee.availableTimes.some((t) => mentor.availableTimes.includes(t));
  if (!hasOverlap) return false;

  // 지망 캠퍼스에 없는 멘토는 제외한다.
  if (!mentee.targetCampus.includes(mentor.currentCampus)) return false;

  return true;
}

/** 프로필 카드에 노출할 해시태그를 멘토 속성에서 만든다. */
export function buildHashtags(mentor: Mentor, mentee: Mentee): string[] {
  const tags = [PERSONAS[mentor.personaType].hashtag];

  if (mentor.mentoringArea.includes("학점관리")) tags.push("#A+폭격기");
  if (mentor.mentoringArea.includes("탐방")) tags.push("#탐방러");
  if (mentor.mentoringArea.includes("교환학생")) tags.push("#교환학생경험");

  // 겹치는 학과·진로가 있으면 그것을 태그로 세운다. 멘티가 자기 관심사를 카드에서 바로 본다.
  const sharedMajor = mentor.currentMajors.find((m) => mentee.targetMajors.includes(m));
  if (sharedMajor) tags.push(`#${sharedMajor}선배`);

  const sharedCareer = mentor.careerPaths.find((c) => mentee.targetCareers.includes(c));
  if (sharedCareer) tags.push(`#${sharedCareer}루트`);

  // 카드가 지저분해지지 않도록 최대 4개까지만 보여준다.
  return tags.slice(0, 4);
}

export function calculateBreakdown(mentee: Mentee, mentor: Mentor): ScoreBreakdown {
  return {
    campus: scoreCampus(mentee, mentor),
    areaAndPersona: scoreAreaAndPersona(mentee, mentor),
    majorAndCareer: scoreMajorAndCareer(mentee, mentor),
    basics: scoreBasics(mentee, mentor),
  };
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
      const total =
        breakdown.campus +
        breakdown.areaAndPersona +
        breakdown.majorAndCareer +
        breakdown.basics;

      return {
        mentor,
        score: Math.round(total),
        breakdown,
        hashtags: buildHashtags(mentor, mentee),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
