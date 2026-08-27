import type { Campus, Career, Gender, Major, MentoringArea, TimeSlot } from "@/shared/constants/domain";
import type { MbtiType } from "@/shared/constants/mbti";
import type { PersonaType } from "@/shared/constants/persona";
import type { Role } from "@/shared/constants/role";

/**
 * 스텝 순서. 배열 순서가 곧 진행 순서이자 진행률 계산 기준이다.
 * 멘티와 멘토는 묻는 내용이 다르므로 순서도 따로 정의한다.
 */
export const MENTEE_STEPS = [
  "persona",
  "mbti",
  "targetCampus",
  "desiredArea",
  "targetMajor",
  "profile",
  "schedule",
  "photo",
] as const;

export const MENTOR_STEPS = [
  "persona",
  "mbti",
  "currentCampus",
  "mentoringArea",
  "currentMajor",
  "profile",
  "schedule",
  "photo",
] as const;

export type MenteeStep = (typeof MENTEE_STEPS)[number];
export type MentorStep = (typeof MENTOR_STEPS)[number];
export type OnboardingStep = MenteeStep | MentorStep;

export const STEPS_BY_ROLE = {
  MENTEE: MENTEE_STEPS,
  MENTOR: MENTOR_STEPS,
} as const satisfies Record<"MENTEE" | "MENTOR", readonly OnboardingStep[]>;

/** 스텝을 진행하며 조금씩 채워지는 초안. 마지막 스텝에서만 완성된다. */
export interface OnboardingDraft {
  // 공통
  personaType?: PersonaType;
  /** 아이스브레이킹용. 모르면 비워둘 수 있다. */
  mbti?: MbtiType;
  name?: string;
  gender?: Gender;
  contact?: string;
  /** 출신 고등학교 */
  highSchool?: string;
  /** 이 서비스를 소개해 준 사람 */
  referrer?: string;
  /** 프로필 사진 (data URL) */
  photoUrl?: string;
  availableTimes: TimeSlot[];

  // 멘티 전용
  targetCampus: Campus[];
  /** 최대 3개. 하나만 골라도 된다. */
  desiredAreas: MentoringArea[];
  targetMajors: Major[];
  targetCareers: Career[];

  // 멘토 전용
  currentCampus?: Campus;
  /** 멘토만 입력한다. 고3 멘티는 아직 학번이 없다. */
  admissionYear?: number;
  mentoringArea: MentoringArea[];
  currentMajors: Major[];
  careerPaths: Career[];
}

export const EMPTY_DRAFT: OnboardingDraft = {
  targetCampus: [],
  desiredAreas: [],
  targetMajors: [],
  targetCareers: [],
  mentoringArea: [],
  currentMajors: [],
  careerPaths: [],
  availableTimes: [],
};

/** 각 스텝 컴포넌트가 공통으로 받는 props. */
export interface StepProps {
  /** 같은 스텝이라도 역할에 따라 묻는 말이 달라진다. */
  role: Extract<Role, "MENTEE" | "MENTOR">;
  draft: OnboardingDraft;
  /**
   * 다음 스텝으로 넘어간다.
   */
  onNext: (patch: Partial<OnboardingDraft>) => void;
  /**
   * 아직 넘어가지 않고 지금까지 고른 값만 draft에 반영한다.
   * 뒤로 갔다 돌아와도 선택이 남아 있으려면 고르는 즉시 저장되어야 한다.
   */
  onChange: (patch: Partial<OnboardingDraft>) => void;
}
