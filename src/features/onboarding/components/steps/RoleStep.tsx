"use client";

import { useRef, useState } from "react";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { OnboardingDraft, StepProps } from "../../model/types";

type RoleValue = NonNullable<OnboardingDraft["role"]>;

/**
 * 고3인지 CCC 대학생인지.
 *
 * "멘티/멘토"로 묻지 않는다. 이 시점에는 아직 멘토링을 신청하지도 않았고,
 * 등록만 하러 온 사람에게 프로그램 용어로 자기를 분류하라고 하면
 * 무엇을 고르는 건지 알 수 없다. 신분으로 물으면 답이 분명해진다.
 *
 * 받아둔 값은 명단을 나누는 데 쓰고, 2단계에서 어떤 질문을 받을지도 정한다.
 */
const OPTIONS: { value: RoleValue; emoji: string; title: string; detail: string }[] = [
  {
    value: "MENTEE",
    emoji: "🎓",
    title: "고3이에요",
    detail: "대학 가기 전, 선배가 궁금해요",
  },
  {
    value: "MENTOR",
    emoji: "🙌",
    title: "CCC 대학생이에요",
    detail: "후배를 만나러 왔어요",
  },
];

export function RoleStep({ draft, onNext, onChange }: StepProps) {
  const [selected, setSelected] = useState<RoleValue | undefined>(draft.role);

  const optionsRef = useRef<HTMLUListElement>(null);
  useStaggerReveal(optionsRef, { selector: "[data-option]", startDelay: 180 });

  const choose = (value: RoleValue) => {
    setSelected(value);
    onChange({ role: value });
  };

  return (
    <StepLayout
      eyebrow="명단을 나누기 위해 여쭤봐요"
      question="어느 쪽에 가까우세요?"
      hint="채플에는 두 분 모두 오실 수 있어요."
      ctaLabel={selected ? "다음" : "하나만 골라주세요"}
      ctaDisabled={!selected}
      onCta={() => selected && onNext({ role: selected })}
    >
      <ul ref={optionsRef} role="radiogroup" className="flex flex-col gap-2.5">
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <li key={option.value} data-option>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(option.value)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors duration-150",
                  active
                    ? "border-brand bg-brand-soft"
                    : "border-transparent bg-gray-50",
                )}
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-[24px]"
                  aria-hidden
                >
                  {option.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-[17px] font-bold",
                      active ? "text-brand" : "text-gray-900",
                    )}
                  >
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-[14px] text-gray-500">
                    {option.detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </StepLayout>
  );
}
