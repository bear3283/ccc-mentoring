/** 멘토링 영역, 시간대, 진로 - 온보딩 선택지이자 매칭 점수의 입력값. */

// 캠퍼스와 학과는 양이 많아 campus.ts 로 분리했다.
// 기존 import 경로를 깨지 않도록 여기서 다시 내보낸다.
export {
  CAMPUSES,
  CAMPUSES_BY_REGION,
  REGIONS,
  MAJOR_FIELDS,
  FIELD_EMOJI,
  COMMON_MAJORS,
  CAMPUS_MAJORS,
  majorsByField,
  fieldOf,
  regionOf,
  isCampus,
} from "./campus";
export type { Campus, Region, MajorField } from "./campus";


export const MENTORING_AREAS = [
  "학점관리",
  "탐방",
  "동아리",
  "대외활동",
  "전공공부",
  "진로설계",
  "교환학생",
  "자취생활",
] as const;

export type MentoringArea = (typeof MENTORING_AREAS)[number];

/**
 * 3열 그리드에서는 설명을 넣을 폭이 없다.
 * 이모지가 설명을 대신해 항목을 빠르게 구분해 준다.
 */
export const AREA_META: Record<MentoringArea, { emoji: string; hint: string }> = {
  학점관리: { emoji: "📚", hint: "수강신청, 시험 준비, 과제 요령" },
  탐방: { emoji: "🚶", hint: "캠퍼스 투어, 학교 분위기 미리보기" },
  동아리: { emoji: "🎪", hint: "동아리 선택과 활동 이야기" },
  대외활동: { emoji: "🏆", hint: "공모전, 서포터즈, 인턴" },
  전공공부: { emoji: "🔬", hint: "전공 커리큘럼과 공부법" },
  진로설계: { emoji: "🧭", hint: "졸업 후 진로 고민 상담" },
  교환학생: { emoji: "✈️", hint: "지원 준비와 현지 생활" },
  자취생활: { emoji: "🏠", hint: "방 구하기, 생활비, 살림" },
};

/**
 * 참여 가능 시간대.
 * 필수 매칭 조건이라 너무 거칠면 "저녁"으로 묶여도 실제로는 못 만나고,
 * 너무 잘게 쪼개면 겹치는 사람이 사라진다. 하루를 5구간으로 나눈 절충안.
 */
export interface TimeSlotDef {
  id: TimeSlot;
  day: "WEEKDAY" | "WEEKEND";
  /** 선택 UI에 쓰는 짧은 이름 */
  label: string;
  /** 오해를 막기 위해 실제 시간 범위를 함께 보여준다 */
  range: string;
  /** 밤 시간대는 대면이 어려워 온라인으로만 만난다 */
  onlineOnly?: boolean;
}

export const TIME_SLOTS = [
  "WEEKDAY_MORNING",
  "WEEKDAY_LUNCH",
  "WEEKDAY_AFTERNOON",
  "WEEKDAY_EVENING",
  "WEEKDAY_NIGHT",
  "WEEKEND_MORNING",
  "WEEKEND_LUNCH",
  "WEEKEND_AFTERNOON",
  "WEEKEND_EVENING",
  "WEEKEND_NIGHT",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

export const TIME_SLOT_DEFS: Record<TimeSlot, TimeSlotDef> = {
  WEEKDAY_MORNING: { id: "WEEKDAY_MORNING", day: "WEEKDAY", label: "오전", range: "09-12시" },
  WEEKDAY_LUNCH: { id: "WEEKDAY_LUNCH", day: "WEEKDAY", label: "점심", range: "12-14시" },
  WEEKDAY_AFTERNOON: { id: "WEEKDAY_AFTERNOON", day: "WEEKDAY", label: "오후", range: "14-18시" },
  WEEKDAY_EVENING: { id: "WEEKDAY_EVENING", day: "WEEKDAY", label: "저녁", range: "18-21시" },
  WEEKDAY_NIGHT: { id: "WEEKDAY_NIGHT", day: "WEEKDAY", label: "밤", range: "21-24시", onlineOnly: true },
  WEEKEND_MORNING: { id: "WEEKEND_MORNING", day: "WEEKEND", label: "오전", range: "09-12시" },
  WEEKEND_LUNCH: { id: "WEEKEND_LUNCH", day: "WEEKEND", label: "점심", range: "12-14시" },
  WEEKEND_AFTERNOON: { id: "WEEKEND_AFTERNOON", day: "WEEKEND", label: "오후", range: "14-18시" },
  WEEKEND_EVENING: { id: "WEEKEND_EVENING", day: "WEEKEND", label: "저녁", range: "18-21시" },
  WEEKEND_NIGHT: { id: "WEEKEND_NIGHT", day: "WEEKEND", label: "밤", range: "21-24시", onlineOnly: true },
};

/** "평일 밤(21-24시, 온라인)" 처럼 사람이 읽는 한 줄로 만든다. */
export function formatTimeSlot(id: TimeSlot): string {
  const def = TIME_SLOT_DEFS[id];
  const day = def.day === "WEEKDAY" ? "평일" : "주말";
  const suffix = def.onlineOnly ? `${def.range}, 온라인` : def.range;
  return `${day} ${def.label}(${suffix})`;
}

/** 표·카드에서 짧게 쓸 때. 온라인 여부는 만날 수 있는지를 좌우하므로 함께 남긴다. */
export function formatTimeSlotShort(id: TimeSlot): string {
  const def = TIME_SLOT_DEFS[id];
  const day = def.day === "WEEKDAY" ? "평일" : "주말";
  return `${day} ${def.label}${def.onlineOnly ? "(온라인)" : ""}`;
}

export const GENDERS = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDERS)[number];

/** 더미 데이터 생성과 예시에 쓰는 대표 학과. 실제 선택지는 학교별로 만들어진다. */
export const MAJORS = [
  "경영학과",
  "컴퓨터공학과",
  "기계공학과",
  "심리학과",
  "국어국문학과",
  "전자공학과",
  "생명과학과",
  "행정학과",
  "미디어커뮤니케이션학과",
  "화학공학과",
  "수학과",
  "사회복지학과",
] as const;

/**
 * 학과는 학교마다 다르다. 고정 목록으로 묶으면 "내 학과가 없다"가 된다.
 * campus.ts 의 majorsByField() 가 학교에 맞는 후보를 만들어 주고,
 * 저장되는 값은 그 문자열이다.
 */
export type Major = string;

export const CAREERS = [
  "대기업 취업",
  "개발자",
  "고시/공무원",
  "대학원 진학",
  "창업",
  "교사",
  "언론/방송",
  "금융권",
  "연구원",
  "선교/사역",
] as const;

export type Career = (typeof CAREERS)[number];
