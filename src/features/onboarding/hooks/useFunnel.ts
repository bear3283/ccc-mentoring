"use client";

import { useCallback, useState } from "react";
import { EMPTY_DRAFT, type OnboardingDraft, type OnboardingStep } from "../model/types";

interface UseFunnelResult {
  step: OnboardingStep;
  stepIndex: number;
  /** 0 ~ 1. ProgressBar에 그대로 넘긴다. */
  progress: number;
  draft: OnboardingDraft;
  isFirst: boolean;
  isLast: boolean;
  /** 현재 스텝의 답을 draft에 반영하고 다음으로 넘어간다. */
  next: (patch: Partial<OnboardingDraft>) => void;
  /** 답은 유지한 채 이전 스텝으로. 되돌아가도 고른 값이 남아있어야 한다. */
  back: () => void;
  /** 스텝을 넘기지 않고 draft만 갱신한다. */
  update: (patch: Partial<OnboardingDraft>) => void;
}

export function useFunnel(
  steps: readonly OnboardingStep[],
  initialDraft: OnboardingDraft | undefined = EMPTY_DRAFT,
): UseFunnelResult {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft ?? EMPTY_DRAFT);

  const next = useCallback(
    (patch: Partial<OnboardingDraft>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    },
    [steps.length],
  );

  const back = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    step: steps[stepIndex],
    stepIndex,
    progress: (stepIndex + 1) / steps.length,
    draft,
    isFirst: stepIndex === 0,
    isLast: stepIndex === steps.length - 1,
    next,
    back,
    update,
  };
}
