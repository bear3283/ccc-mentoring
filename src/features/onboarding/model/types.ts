import type { Campus, Career, Gender, Major, MentoringArea, TimeSlot } from "@/shared/constants/domain";
import type { MbtiType } from "@/shared/constants/mbti";
import type { PersonaType } from "@/shared/constants/persona";
import type { Role } from "@/shared/constants/role";

/**
 * 가입은 두 단계다.
 *
 * 1단계(행사 등록)는 행사에 오는 모든 사람이 거친다. 여기서 저장되고
 * 참여코드가 나온다. 2단계(멘토링 신청)는 원하는 사람만 이어서 한다.
 *
 * 한 번에 다 묻던 것을 나눈 이유: 행사 등록만 하려는 사람에게
 * 성경 인물과 MBTI부터 물으면 등록 자체를 포기한다.
 */

/** 1단계 — 행사 등록. 이것만 해도 행사에 올 수 있다. */
export const REGISTER_STEPS_BY_ROLE = {
  MENTEE: ["consent", "basic", "targetCampus", "church"],
  MENTOR: ["consent", "basic", "currentCampus", "church"],
} as const;

/** 2단계 — 멘토링 신청. 선택이다. */
export const MENTORING_STEPS_BY_ROLE = {
  MENTEE: ["mentoringIntro", "persona", "mbti", "desiredArea", "targetMajor", "schedule", "photo"],
  MENTOR: ["mentoringIntro", "persona", "mbti", "mentoringArea", "currentMajor", "schedule", "photo"],
} as const;

export type RegisterStep = (typeof REGISTER_STEPS_BY_ROLE)["MENTEE" | "MENTOR"][number];
export type MentoringStep = (typeof MENTORING_STEPS_BY_ROLE)["MENTEE" | "MENTOR"][number];
export type OnboardingStep = RegisterStep | MentoringStep;

/** 두 단계를 이어 붙인 전체. 진행률이 아니라 목록이 필요할 때 쓴다. */
export const STEPS_BY_ROLE = {
  MENTEE: [...REGISTER_STEPS_BY_ROLE.MENTEE, ...MENTORING_STEPS_BY_ROLE.MENTEE],
  MENTOR: [...REGISTER_STEPS_BY_ROLE.MENTOR, ...MENTORING_STEPS_BY_ROLE.MENTOR],
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
  /**
   * 출석하는 교회. 없으면 비우고 isNewFriend 를 세운다.
   * 행사에서 새친구를 따로 챙기기 위한 구분이다.
   */
  church?: string;
  isNewFriend?: boolean;
  /** 2단계까지 마쳤는지. 등록만 한 사람과 구분한다. */
  mentoringApplied?: boolean;
  /** 프로필 사진 (data URL) */
  photoUrl?: string;
  /** 개인정보 동의 시각 (ISO). 없으면 서버가 신청을 거부한다. */
  consentedAt?: string;
  /** 동의한 문구의 버전. 문구가 바뀌어도 무엇에 동의했는지 남는다. */
  consentVersion?: string;
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
  isNewFriend: false,
  mentoringApplied: false,
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
