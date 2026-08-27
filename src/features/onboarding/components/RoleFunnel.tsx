"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@/shared/constants/role";
import { saveDraft } from "../lib/draftStore";
import { generateParticipationCode } from "../lib/participationCode";
import { OnboardingFunnel, type StepRegistry } from "./OnboardingFunnel";
import { AreaStep } from "./steps/AreaStep";
import { CampusStep } from "./steps/CampusStep";
import { MajorStep } from "./steps/MajorStep";
import { MbtiStep } from "./steps/MbtiStep";
import { PersonaStep } from "./steps/PersonaStep";
import { PhotoStep } from "./steps/PhotoStep";
import { ProfileStep } from "./steps/ProfileStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import { STEPS_BY_ROLE, type OnboardingDraft, type OnboardingStep } from "../model/types";

/**
 * 현재 구현이 끝난 스텝만 퍼널에 태운다.
 * 새 스텝을 만들면 REGISTRY 에 등록하고 ACTIVE_STEPS 필터가 자동으로 통과시킨다.
 */
const REGISTRY: StepRegistry = {
  persona: PersonaStep,
  mbti: MbtiStep,
  // 캠퍼스는 역할에 따라 3지망 선택 / 단일 선택으로 갈린다.
  targetCampus: CampusStep,
  currentCampus: CampusStep,
  // 영역도 멘티는 하나, 멘토는 여러 개를 고른다.
  desiredArea: AreaStep,
  mentoringArea: AreaStep,
  targetMajor: MajorStep,
  currentMajor: MajorStep,
  profile: ProfileStep,
  schedule: ScheduleStep,
  photo: PhotoStep,
};

interface RoleFunnelProps {
  role: Extract<Role, "MENTEE" | "MENTOR">;
}

export function RoleFunnel({ role }: RoleFunnelProps) {
  const router = useRouter();

  // 역할별 전체 스텝 중 실제로 구현된 것만 추린다.
  const activeSteps = STEPS_BY_ROLE[role].filter(
    (step): step is OnboardingStep => step in REGISTRY,
  );

  const handleComplete = (draft: OnboardingDraft) => {
    // 제출 시점에 참여코드를 발급하고 draft와 함께 보관한다.
    // Supabase를 붙이면 이 두 줄이 서버 저장 호출로 바뀐다.
    const participationCode = generateParticipationCode();
    saveDraft(role, draft, participationCode);

    router.push("/onboarding/complete");
  };

  return (
    <OnboardingFunnel
      role={role}
      steps={activeSteps}
      registry={REGISTRY}
      onComplete={handleComplete}
    />
  );
}
