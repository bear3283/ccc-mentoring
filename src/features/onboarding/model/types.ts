import type {
  Campus,
  Career,
  Gender,
  Major,
  MentorCapacity,
  MentoringArea,
} from "@/shared/constants/domain";
import type { MbtiType } from "@/shared/constants/mbti";
import type { PersonaType } from "@/shared/constants/persona";
import type { Role } from "@/shared/constants/role";
import type { EventArrival } from "@/shared/constants/venue";

/**
 * 가입은 두 단계다.
 *
 * 1단계(고3채플 등록)는 행사에 오는 모든 사람이 거친다. 여기서 저장되고
 * 참여코드가 나온다. 2단계(멘토링 신청)는 원하는 사람만 이어서 한다.
 *
 * 한 번에 다 묻던 것을 나눈 이유: 등록만 하려는 사람에게
 * 성경 인물과 MBTI부터 물으면 등록 자체를 포기한다.
 *
 * 1단계는 역할에 상관없이 모두 같은 질문을 받는다. 채플에 오는 데 필요한
 * 정보만 묻기 때문이다. 고3인지 대학생인지는 명단을 나누기 위해 받아두되,
 * 질문이 갈라지는 것은 2단계부터다 — 캠퍼스는 매칭에 쓰는 정보이지
 * 채플에 오는 데 필요한 정보가 아니다.
 */

/** 1단계 — 고3채플 등록. 역할과 무관하게 모두 같은 순서다. */
export const REGISTER_STEPS = ["consent", "basic", "role", "extra"] as const;

/**
 * 2단계 — 멘토링 신청. 선택이다.
 *
 * 가볍게 답할 수 있는 것(성경 인물·MBTI·관심 영역)을 앞에 두고,
 * 진지하게 고민해야 하는 학교·학과를 뒤로 미룬다. 첫 질문이 무거우면
 * 거기서 멈춘다.
 *
 * 캠퍼스는 학과 바로 앞이어야 한다. 학과 선택지가 여기서 고른 학교로 좁혀진다.
 *
 * 1:1 멘토링 날짜는 묻지 않는다. 매칭된 뒤 선배·후배가 문자로 정한다.
 * 채플 당일 도착 시간(eventArrival)만 받고, 채플이 지난 뒤에는 RoleFunnel 이
 * 이 스텝을 건너뛴다.
 *
 * 성별(gender)은 등록(BasicStep)에서 받고 여기서 다시 묻지 않는다. 멘토링 신청은
 * 등록할 때 이 브라우저에 남긴 초안 위에 이어 쓰므로 성별이 이미 들어 있다.
 * 성별을 받기 전에 등록한 사람도 같은 이름·번호로 다시 등록하면 성별을 고르게 되고,
 * 멘토링을 신청할 때 그 값이 저장된다.
 */
export const MENTORING_STEPS_BY_ROLE = {
  MENTEE: [
    "mentoringIntro", "persona", "mbti", "desiredArea",
    "targetCampus", "targetMajor", "eventArrival", "photo",
  ],
  MENTOR: [
    "mentoringIntro", "persona", "mbti", "mentoringArea",
    "currentCampus", "currentMajor", "capacity", "eventArrival", "photo",
  ],
} as const;

export type RegisterStep = (typeof REGISTER_STEPS)[number];
export type MentoringStep = (typeof MENTORING_STEPS_BY_ROLE)["MENTEE" | "MENTOR"][number];
export type OnboardingStep = RegisterStep | MentoringStep;

/** 두 단계를 이어 붙인 전체. 진행률이 아니라 목록이 필요할 때 쓴다. */
export const STEPS_BY_ROLE = {
  MENTEE: [...REGISTER_STEPS, ...MENTORING_STEPS_BY_ROLE.MENTEE],
  MENTOR: [...REGISTER_STEPS, ...MENTORING_STEPS_BY_ROLE.MENTOR],
} as const satisfies Record<"MENTEE" | "MENTOR", readonly OnboardingStep[]>;

/** 스텝을 진행하며 조금씩 채워지는 초안. 마지막 스텝에서만 완성된다. */
export interface OnboardingDraft {
  // 공통
  /**
   * 고3인지 CCC 대학생인지. 1단계에서 받는다.
   *
   * 등록만 하고 가는 사람도 명단에서 구분되어야 해서 여기서 묻는다.
   * 이 값이 2단계에서 어떤 질문을 받을지도 정한다.
   */
  role?: Extract<Role, "MENTEE" | "MENTOR">;
  /** 비어 있으면 성경 인물을 고르지 않은 것이다. "잘 모르겠어요"면 personaUnknown 이 선다. */
  personaType?: PersonaType;
  /** 성경 인물을 "잘 모르겠어요"로 골랐는지. 화면에서 선택을 되살리는 데만 쓴다. */
  personaUnknown?: boolean;
  /** 아이스브레이킹용. 모르면 비워둘 수 있다. */
  mbti?: MbtiType;
  name?: string;
  /** 같은 성별끼리만 매칭한다. 등록할 때 받는다. */
  gender?: Gender;
  contact?: string;
  /** 출신 고등학교 */
  highSchool?: string;
  /** 이 서비스를 소개해 준 사람 */
  referrer?: string;
  /**
   * 출석하는 교회와 새친구 여부. 2026-10-26부터 묻지 않는다.
   * 그 전에 등록한 사람의 값을 운영자 표에 보여주려고 타입만 남긴다.
   */
  church?: string;
  isNewFriend?: boolean;
  /** 2단계까지 마쳤는지. 등록만 한 사람과 구분한다. */
  mentoringApplied?: boolean;
  /** 프로필 사진 (data URL) */
  photoUrl?: string;
  /** 채플 당일 몇 시에 올 수 있는지. 매칭된 상대와 운영자에게 보여준다. */
  eventArrival?: EventArrival;
  /** 개인정보 동의 시각 (ISO). 없으면 서버가 신청을 거부한다. */
  consentedAt?: string;
  /** 동의한 문구의 버전. 문구가 바뀌어도 무엇에 동의했는지 남는다. */
  consentVersion?: string;

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
  /** 동시에 맡을 후배 수. 비어 있으면 서버가 1명으로 저장한다. */
  mentorCapacity?: MentorCapacity;
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
