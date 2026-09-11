import {
  CAMPUSES,
  CAREERS,
  GENDERS,
  MAJORS,
  MENTORING_AREAS,
  TIME_SLOTS,
  type Campus,
  type TimeSlot,
} from "@/shared/constants/domain";
import { MBTI_TYPES } from "@/shared/constants/mbti";
import { PERSONA_TYPES } from "@/shared/constants/persona";
import type { Mentee, Mentor } from "@/features/matching/model/types";

/**
 * 시드 기반 의사난수(mulberry32).
 * Math.random을 쓰면 실행할 때마다 결과가 달라져서 매칭 결과를 비교 검증할 수 없다.
 * 같은 시드 -> 항상 같은 더미 데이터.
 */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return function random(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = ReturnType<typeof createRandom>;

function pick<T>(random: Random, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

/** 중복 없이 n개 뽑는다. */
function pickMany<T>(random: Random, list: readonly T[], count: number): T[] {
  const pool = [...list];
  const picked: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    picked.push(...pool.splice(Math.floor(random() * pool.length), 1));
  }
  return picked;
}

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오"];
const GIVEN_NAMES = [
  "지훈", "서연", "민준", "하은", "도윤", "수빈", "예준", "지우", "시우", "채원",
  "주원", "다은", "건우", "소율", "우진", "유진", "현우", "가은", "선우", "예린",
];

function makeName(random: Random): string {
  return `${pick(random, SURNAMES)}${pick(random, GIVEN_NAMES)}`;
}

function makeContact(random: Random): string {
  const mid = String(Math.floor(random() * 10000)).padStart(4, "0");
  const last = String(Math.floor(random() * 10000)).padStart(4, "0");
  return `010-${mid}-${last}`;
}

/**
 * 시간대는 2~6개를 뽑는다.
 * 슬롯을 10개로 세분화했기 때문에 예전처럼 1~4개만 고르면
 * 겹치는 사람이 급감해 매칭 자체가 성립하지 않는다.
 */
function makeTimes(random: Random): TimeSlot[] {
  return pickMany(random, TIME_SLOTS, 2 + Math.floor(random() * 5));
}

const HIGH_SCHOOL_PREFIX = [
  "한빛", "동성", "서일", "명진", "청운", "대광", "신영", "수리", "은성", "예일",
];

/** 참여코드에 쓰는 알파벳. 실제 발급기와 같은 집합을 쓴다. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * 더미용 참여코드. 실제 발급은 crypto 난수를 쓰지만,
 * 더미는 시드에서 나와야 매번 같은 값이 재현된다.
 */
function makeCode(random: Random): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** 자기 유형을 모르는 사람도 있으므로 20%는 비워 둔다. */
function makeMbti(random: Random) {
  return random() < 0.2 ? undefined : pick(random, MBTI_TYPES);
}

const CURRENT_YEAR = 2026;

export function generateMentors(count = 50, seed = 20260827): Mentor[] {
  const random = createRandom(seed);

  return Array.from({ length: count }, (_, i) => {
    // 학번 범위를 정하기 위해 재학 연차를 먼저 뽑는다.
    const yearsEnrolled = Math.floor(random() * 6);

    return {
      id: `mentor-${String(i + 1).padStart(3, "0")}`,
      participationCode: makeCode(random),
      name: makeName(random),
      gender: pick(random, GENDERS),
      contact: makeContact(random),
      availableTimes: makeTimes(random),
      currentCampus: pick(random, CAMPUSES),
      admissionYear: CURRENT_YEAR - yearsEnrolled,
      // 멘토는 여러 영역을 도울 수 있다.
      mentoringArea: pickMany(random, MENTORING_AREAS, 1 + Math.floor(random() * 3)),
      personaType: pick(random, PERSONA_TYPES),
      mbti: makeMbti(random),
      // 복수전공·부전공이 흔해 최대 2개까지 잡는다.
      currentMajors: pickMany(random, MAJORS, 1 + Math.floor(random() * 2)),
      careerPaths: pickMany(random, CAREERS, 1 + Math.floor(random() * 2)),
      highSchool: `${pick(random, HIGH_SCHOOL_PREFIX)}고등학교`,
      // 더미는 매칭 화면 확인용이라 멘토링까지 마친 상태로 만든다.
      mentoringApplied: true,
    };
  });
}

export function generateMentees(count = 50, seed = 19970416): Mentee[] {
  const random = createRandom(seed);

  return Array.from({ length: count }, (_, i) => ({
    id: `mentee-${String(i + 1).padStart(3, "0")}`,
    participationCode: makeCode(random),
    name: makeName(random),
    gender: pick(random, GENDERS),
    contact: makeContact(random),
    availableTimes: makeTimes(random),
    // 1~3지망. 중복 없이 3개.
    targetCampus: pickMany(random, CAMPUSES, 3) as Campus[],
    // 최대 3개. 하나만 고르는 사람도 많다.
    desiredAreas: pickMany(random, MENTORING_AREAS, 1 + Math.floor(random() * 3)),
    personaType: pick(random, PERSONA_TYPES),
    mbti: makeMbti(random),
    targetMajors: pickMany(random, MAJORS, 1 + Math.floor(random() * 3)),
    targetCareers: pickMany(random, CAREERS, 1 + Math.floor(random() * 3)),
    highSchool: `${pick(random, HIGH_SCHOOL_PREFIX)}고등학교`,
    mentoringApplied: true,
  }));
}

export const MOCK_MENTORS: Mentor[] = generateMentors();
export const MOCK_MENTEES: Mentee[] = generateMentees();
