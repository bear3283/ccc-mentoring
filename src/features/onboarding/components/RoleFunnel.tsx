"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/shared/constants/role";
import { saveDraft } from "../lib/draftStore";
import { OnboardingFunnel, type StepRegistry } from "./OnboardingFunnel";
import { AreaStep } from "./steps/AreaStep";
import { CampusStep } from "./steps/CampusStep";
import { ConsentStep } from "./steps/ConsentStep";
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
  consent: ConsentStep,
  profile: ProfileStep,
  schedule: ScheduleStep,
  photo: PhotoStep,
};

interface RoleFunnelProps {
  role: Extract<Role, "MENTEE" | "MENTOR">;
}

export function RoleFunnel({ role }: RoleFunnelProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  // 역할별 전체 스텝 중 실제로 구현된 것만 추린다.
  const activeSteps = STEPS_BY_ROLE[role].filter(
    (step): step is OnboardingStep => step in REGISTRY,
  );

  const handleComplete = async (draft: OnboardingDraft) => {
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);

    try {
      // 참여코드는 서버가 발급한다. 브라우저가 정한 코드를 그대로 쓰면
      // 원하는 코드를 골라 넣거나 남의 코드와 충돌시키는 요청을 만들 수 있다.
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, draft }),
      });

      const body = (await res.json()) as { participationCode?: string; error?: string };

      if (!res.ok || !body.participationCode) {
        setError(body.error ?? "저장하지 못했어요. 잠시 후 다시 시도해주세요.");
        setSubmitting(false);
        return;
      }

      // 완료 화면과 결과 화면이 읽을 수 있게 이 브라우저에도 남긴다.
      saveDraft(role, draft, body.participationCode);
      router.push("/onboarding/complete");
    } catch {
      setError("연결에 실패했어요. 인터넷 상태를 확인해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <OnboardingFunnel
        role={role}
        steps={activeSteps}
        registry={REGISTRY}
        onComplete={handleComplete}
      />

      {/* 제출 실패는 마지막 스텝 위에 덮어 보여준다. 화면을 벗어나면 다시 채워야 한다. */}
      {error && (
        <div className="fixed inset-x-0 bottom-[max(90px,env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <p className="w-full max-w-[390px] rounded-2xl bg-red-500 px-5 py-4 text-center text-[14px] font-semibold text-white shadow-lg">
            {error}
          </p>
        </div>
      )}
    </>
  );
}
