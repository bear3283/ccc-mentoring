import type {
  Campus,
  Career,
  Gender,
  Major,
  MentoringArea,
  TimeSlot,
} from "@/shared/constants/domain";
import type { MbtiType } from "@/shared/constants/mbti";
import type { PersonaType } from "@/shared/constants/persona";

/** DB의 Users + Mentee_Profiles를 조인한 형태 */
export interface Mentee {
  id: string;
  /** 신청 완료 시 발급되는 참여코드. 문의·조회의 기준이 된다. */
  participationCode: string;
  name: string;
  gender: Gender;
  contact: string;
  /** 어느 고등학교에서 왔는지 */
  highSchool?: string;
  /** 이 서비스를 소개해 준 사람 */
  referrer?: string;
  /** 출석하는 교회. 새친구면 비어 있다. */
  church?: string;
  /** 다니는 교회가 없는 참가자. 행사에서 따로 챙긴다. */
  isNewFriend?: boolean;
  /** 행사 등록만 했는지, 멘토링까지 신청했는지 */
  mentoringApplied?: boolean;
  /** 프로필 사진 (data URL). 없으면 페르소나 이모지로 대체한다. */
  photoUrl?: string;
  availableTimes: TimeSlot[];
  /** 1~3지망. 인덱스 0이 1지망. */
  targetCampus: Campus[];
  /** 최대 3개. 하나만 골라도 된다. */
  desiredAreas: MentoringArea[];
  personaType: PersonaType;
  /** 아이스브레이킹으로 받은 값. 매칭 점수에는 쓰지 않는다. */
  mbti?: MbtiType;
  targetMajors: Major[];
  targetCareers: Career[];
}

/** DB의 Users + Mentor_Profiles를 조인한 형태 */
export interface Mentor {
  id: string;
  participationCode: string;
  name: string;
  gender: Gender;
  contact: string;
  highSchool?: string;
  referrer?: string;
  /** 출석하는 교회. 새친구면 비어 있다. */
  church?: string;
  /** 다니는 교회가 없는 참가자. 행사에서 따로 챙긴다. */
  isNewFriend?: boolean;
  /** 행사 등록만 했는지, 멘토링까지 신청했는지 */
  mentoringApplied?: boolean;
  photoUrl?: string;
  availableTimes: TimeSlot[];
  currentCampus: Campus;
  /** 입학 연도. 화면에는 뒤 두 자리를 따 '24학번'으로 보여준다. */
  admissionYear: number;
  mentoringArea: MentoringArea[];
  personaType: PersonaType;
  mbti?: MbtiType;
  currentMajors: Major[];
  careerPaths: Career[];
}

/** 점수의 근거. UI에서 "왜 이 멘토인지" 보여주고, 가중치 튜닝 시 디버깅에 쓴다. */
export interface ScoreBreakdown {
  campus: number;
  area: number;
  schedule: number;
  mbti: number;
  majorAndCareer: number;
  persona: number;
}

export interface MatchResult {
  mentor: Mentor;
  /** 0 ~ 100 적합도 */
  score: number;
  breakdown: ScoreBreakdown;
  /** 프로필 카드에 노출할 해시태그 */
  hashtags: string[];
}

/**
 * 매칭 API가 브라우저로 돌려주는 형태.
 * Mentor 전체가 아니라 카드에 필요한 항목만 담고,
 * 연락처는 가린 값만 넣는다.
 */
export interface PublicMentor {
  id: string;
  name: string;
  currentCampus: Campus;
  currentMajors: Major[];
  admissionYear: number;
  careerPaths: Career[];
  mentoringArea: MentoringArea[];
  personaType: PersonaType;
  mbti?: MbtiType;
  photoUrl?: string;
  availableTimes: TimeSlot[];
  /** 010-****-5678. 전체 번호는 매칭 요청 후에 공개한다. */
  maskedContact: string;
}

export interface PublicMatchResult {
  score: number;
  hashtags: string[];
  mentor: PublicMentor;
  /** 겹치는 시간이 하나도 없음. 카드에 경고를 띄운다. */
  noTimeOverlap: boolean;
}

/**
 * 결과가 없거나 아쉬울 때 참가자에게 이유를 알려주기 위한 정보.
 * "조건에 맞는 멘토가 없어요" 만으로는 무엇을 고쳐야 할지 알 수 없다.
 */
export interface MatchDiagnosis {
  /** 지망 캠퍼스에 있는 멘토 수 */
  inTargetCampus: number;
  /** 그중 시간이 하나도 안 겹치는 수 */
  noTimeOverlap: number;
  /** 전체 멘토 수 */
  totalMentors: number;
  /** 멘토가 한 명도 없는 지망 캠퍼스 */
  emptyCampuses: string[];
}
