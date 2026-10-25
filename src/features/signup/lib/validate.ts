import { CONSENT_VERSION } from "@/shared/constants/privacy";
import { GENDERS, MENTOR_CAPACITY_OPTIONS } from "@/shared/constants/domain";
import { MBTI_TYPES } from "@/shared/constants/mbti";
import { isEventArrival } from "@/shared/constants/venue";
import type { OnboardingDraft } from "@/features/onboarding/model/types";

/**
 * 서버에서 다시 검증한다.
 * 브라우저 검증은 사용자를 돕는 장치일 뿐, 요청을 직접 만들면 그냥 우회된다.
 *
 * 가입이 두 단계로 나뉘면서 검증도 나뉘었다.
 * 행사 등록만 한 사람에게 성향·관심사를 요구하면 등록 자체가 막힌다.
 */

/** 같은 성별끼리만 매칭하므로 두 단계 모두 성별을 확인한다. */
function isGender(value: unknown): boolean {
  return typeof value === "string" && (GENDERS as readonly string[]).includes(value);
}

/** 사진은 data URL로 들어온다. 지나치게 크면 저장소와 응답이 함께 무거워진다. */
const MAX_PHOTO_BYTES = 400_000;

/** 1단계 — 행사 등록. 행사에 오는 모든 사람이 통과해야 한다. */
export function validateRegistration(
  role: "MENTEE" | "MENTOR",
  draft: OnboardingDraft,
): string | null {
  if (!draft) return "잘못된 요청이에요.";

  if (!draft.name || draft.name.trim().length < 2) return "이름을 확인해주세요.";
  if (draft.name.trim().length > 20) return "이름이 너무 길어요.";
  if (!draft.contact || !/^01[016-9]-\d{3,4}-\d{4}$/.test(draft.contact)) {
    return "연락처 형식을 확인해주세요.";
  }
  if (!isGender(draft.gender)) return "성별을 골라주세요.";

  // 동의는 브라우저에서 체크박스를 지나쳐도 서버가 다시 막는다.
  if (!draft.consentedAt || !draft.consentVersion) {
    return "개인정보 동의가 필요해요.";
  }
  if (draft.consentVersion !== CONSENT_VERSION) {
    return "동의 문구가 변경되었어요. 화면을 새로고침한 뒤 다시 시도해주세요.";
  }

  // 캠퍼스는 여기서 보지 않는다. 채플에 오는 데 필요한 정보가 아니라
  // 매칭에 쓰는 정보라 2단계로 옮겼다.
  if (draft.role && draft.role !== role) {
    return "잘못된 요청이에요.";
  }

  return null;
}

/** 2단계 — 멘토링 신청. 원하는 사람만 통과하면 된다. */
export function validateMentoring(
  role: "MENTEE" | "MENTOR",
  draft: OnboardingDraft,
): string | null {
  if (!draft) return "잘못된 요청이에요.";

  // 성별을 받기 전에 등록한 사람은 멘토링 신청에서 처음 고른다.
  if (!isGender(draft.gender)) return "성별을 골라주세요.";
  if (!draft.personaType) return "성향을 골라주세요.";

  // MBTI 는 건너뛸 수 있지만, 적었다면 16개 유형 중 하나여야 한다.
  // 여기서 막지 않으면 DB 제약에 걸려 "저장하지 못했어요"만 보게 된다.
  if (draft.mbti && !(MBTI_TYPES as readonly string[]).includes(draft.mbti)) {
    return "MBTI를 다시 확인해주세요.";
  }

  // 채플이 지난 뒤에는 묻지 않아 비어 있을 수 있다. 적었다면 고를 수 있는 값이어야 한다.
  if (draft.eventArrival !== undefined && !isEventArrival(draft.eventArrival)) {
    return "채플 당일 오는 시간을 다시 골라주세요.";
  }

  // 캠퍼스는 2단계로 옮겨왔다. 프로필 행이 여기서 처음 만들어지므로
  // 비어 있으면 DB 제약에 걸려 저장 단계에서야 실패한다.
  if (role === "MENTEE") {
    if (draft.targetCampus.length < 1 || draft.targetCampus.length > 3) {
      return "지망 학교를 확인해주세요.";
    }
    if (draft.desiredAreas.length < 1 || draft.desiredAreas.length > 3) {
      return "관심 분야를 확인해주세요.";
    }
    if (draft.targetMajors.length < 1 || draft.targetMajors.length > 3) {
      return "희망 학과를 확인해주세요.";
    }
    if (draft.targetCareers.length < 1 || draft.targetCareers.length > 3) {
      return "희망 진로를 확인해주세요.";
    }
  } else {
    if (!draft.currentCampus) return "학교를 골라주세요.";
    if (!draft.admissionYear) return "학번을 골라주세요.";
    if (draft.mentoringArea.length < 1) return "도와줄 영역을 골라주세요.";
    if (draft.currentMajors.length < 1 || draft.currentMajors.length > 3) {
      return "전공을 확인해주세요.";
    }
    if (draft.careerPaths.length < 1 || draft.careerPaths.length > 3) {
      return "진로를 확인해주세요.";
    }
    // 비어 있으면 1명으로 저장한다(정원을 묻기 전 화면에서 온 신청).
    // 적었다면 고를 수 있는 값이어야 한다. DB 제약에 걸리면 이유를 알 수 없다.
    if (
      draft.mentorCapacity !== undefined &&
      !(MENTOR_CAPACITY_OPTIONS as readonly number[]).includes(draft.mentorCapacity)
    ) {
      return "맡을 후배 수를 다시 골라주세요.";
    }
  }

  if (draft.photoUrl && draft.photoUrl.length > MAX_PHOTO_BYTES) {
    return "사진 용량이 너무 커요.";
  }

  return null;
}
