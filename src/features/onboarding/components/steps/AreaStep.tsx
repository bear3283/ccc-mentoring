"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";
import { AREA_META, MENTORING_AREAS, type MentoringArea } from "@/shared/constants/domain";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { DURATION, REVEAL_EASE } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 멘티가 고를 수 있는 최대 개수. 하나만 골라도 넘어간다. */
const MAX_CHOICES = 3;

export function AreaStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentee = role === "MENTEE";

  const [selected, setSelected] = useState<MentoringArea[]>(
    isMentee ? draft.desiredAreas : draft.mentoringArea,
  );

  const gridRef = useRef<HTMLUListElement>(null);
  useStaggerReveal(gridRef, { selector: "[data-option]", startDelay: 160, gap: 40 });

  const toggle = (area: MentoringArea, el: HTMLElement) => {
    setSelected((prev) => {
      if (prev.includes(area)) return prev.filter((a) => a !== area);
      // 멘티만 3개 상한이 있다. 멘토는 도울 수 있는 만큼 다 고를 수 있어야 한다.
      if (isMentee && prev.length >= MAX_CHOICES) return prev;
      return [...prev, area];
    });
    animate(el, { scale: [0.96, 1], duration: DURATION.fade, ease: REVEAL_EASE });
  };


  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    if (isMentee) onChange({ desiredAreas: selected });
    else onChange({ mentoringArea: selected });
  }, [selected, isMentee, onChange]);

  const atLimit = isMentee && selected.length >= MAX_CHOICES;

  const handleNext = () => {
    if (isMentee) onNext({ desiredAreas: selected });
    else onNext({ mentoringArea: selected });
  };

  return (
    <StepLayout
      eyebrow={isMentee ? `궁금한 것 최대 ${MAX_CHOICES}개` : "도와줄 수 있는 것 모두"}
      question={isMentee ? "어떤 게 제일 궁금해요?" : "어떤 걸 도와줄 수 있나요?"}
      hint={
        isMentee
          ? `하나만 골라도 괜찮아요. 최대 ${MAX_CHOICES}개까지 고를 수 있어요.`
          : "여러 개 골라도 좋아요. 많을수록 더 많은 후배와 이어져요."
      }
      ctaLabel={
        selected.length === 0
          ? "하나 이상 골라주세요"
          : `다음 (${selected.length}개)`
      }
      ctaDisabled={selected.length === 0}
      onCta={handleNext}
    >
      {/* 3열 격자. 항목이 8개라 3-3-2로 떨어지고, 한 화면에 전부 들어온다. */}
      <ul ref={gridRef} role="group" className="grid grid-cols-3 gap-2">
        {MENTORING_AREAS.map((area) => {
          const isOn = selected.includes(area);
          // 상한에 걸린 미선택 항목은 눌러도 반응이 없으므로 흐리게 해 미리 알린다.
          const blocked = !isOn && atLimit;

          return (
            <li key={area} data-option>
              <button
                type="button"
                role="checkbox"
                aria-checked={isOn}
                aria-disabled={blocked}
                onClick={(e) => !blocked && toggle(area, e.currentTarget)}
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center gap-1.5",
                  "rounded-2xl border-2 px-1 transition-colors duration-150",
                  isOn
                    ? "border-brand bg-brand-soft"
                    : "border-transparent bg-gray-50",
                  blocked && "opacity-40",
                )}
              >
                <span className="text-[26px]" aria-hidden>
                  {AREA_META[area].emoji}
                </span>
                <span
                  className={cn(
                    "text-center text-[13px] leading-tight font-bold",
                    isOn ? "text-brand" : "text-gray-800",
                  )}
                >
                  {area}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 격자에는 설명을 넣을 폭이 없어, 고른 항목의 설명만 아래에 모아 보여준다. */}
      {selected.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {selected.map((area) => (
            <li key={area} className="flex gap-2 text-[13px] leading-relaxed text-gray-500">
              <span className="font-semibold text-gray-700">{area}</span>
              <span>{AREA_META[area].hint}</span>
            </li>
          ))}
        </ul>
      )}
    </StepLayout>
  );
}
