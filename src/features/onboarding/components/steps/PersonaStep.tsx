"use client";

import { animate, utils } from "animejs";
import { useEffect, useRef, useState } from "react";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { DURATION, REVEAL_EASE, TAP_SPRING } from "@/shared/lib/anime";
import { PERSONA_LIST, type PersonaType } from "@/shared/constants/persona";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 같은 질문이지만 멘티는 '되고 싶은' 모습을, 멘토는 '지금 나에 가까운' 모습을 고른다. */
const COPY = {
  MENTEE: {
    eyebrow: "시작하기 전에, 가볍게 하나만",
    question: "어떤 성경 인물과 닮고 싶나요?",
    hint: "정답은 없어요. 비슷한 멘토를 찾는 데만 써요.",
  },
  MENTOR: {
    eyebrow: "시작하기 전에, 가볍게 하나만",
    question: "어떤 성경 인물과 닮았나요?",
    hint: "후배에게 나를 소개할 때 쓰는 한 마디예요.",
  },
} as const;

export function PersonaStep({ role, draft, onNext, onChange }: StepProps) {
  const copy = COPY[role];
  const [selected, setSelected] = useState<PersonaType | undefined>(draft.personaType);

  const optionsRef = useRef<HTMLUListElement>(null);
  const checkRef = useRef<SVGSVGElement>(null);

  // 선택지 4개: Fade-in & Slide-up 스태거. 헤더가 먼저 뜨고 이어서 붙는다.
  useStaggerReveal(optionsRef, {
    selector: "[data-option]",
    startDelay: 180,
  });

  // 선택할 때마다 체크 아이콘이 톡 튀어나온다.
  useEffect(() => {
    if (!selected || !checkRef.current) return;
    const target = checkRef.current;
    utils.set(target, { scale: 0.4, opacity: 0 });
    animate(target, { scale: [0.4, 1], opacity: [0, 1], ease: TAP_SPRING });
    return () => {
      utils.remove(target);
    };
  }, [selected]);


  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    if (selected) onChange({ personaType: selected });
  }, [selected, onChange]);

  const handleSelect = (type: PersonaType, element: HTMLElement) => {
    setSelected(type);
    // 눌린 카드만 살짝 반응시켜 어디를 골랐는지 즉시 알린다.
    animate(element, { scale: [0.98, 1], duration: DURATION.fade, ease: REVEAL_EASE });
  };

  return (
    <StepLayout
      eyebrow={copy.eyebrow}
      question={copy.question}
      hint={copy.hint}
      ctaLabel={selected ? "다음" : "하나만 골라주세요"}
      ctaDisabled={!selected}
      onCta={() => selected && onNext({ personaType: selected })}
    >
      <ul ref={optionsRef} role="radiogroup" className="flex flex-col gap-2">
        {PERSONA_LIST.map((persona) => {
          const isSelected = selected === persona.type;

          return (
            <li key={persona.type} data-option>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={(e) => handleSelect(persona.type, e.currentTarget)}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left",
                  "transition-colors duration-150",
                  isSelected ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full text-[22px]",
                    isSelected ? "bg-white" : "bg-white/70",
                  )}
                  aria-hidden
                >
                  {persona.emoji}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold text-gray-900">
                    {persona.name}
                  </span>
                  <span className="mt-0.5 block text-[14px] text-gray-500">
                    {persona.description}
                  </span>
                </span>

                {/* 선택 표시는 자리를 항상 차지해 두어 고를 때 레이아웃이 흔들리지 않는다. */}
                <span className="size-6 shrink-0">
                  {isSelected && (
                    <svg
                      ref={checkRef}
                      viewBox="0 0 24 24"
                      className="size-6 text-brand"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5.03 7.53-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.47-5.47a.75.75 0 0 1 1.06 1.06Z" />
                    </svg>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </StepLayout>
  );
}
