"use client";

import { animate, utils } from "animejs";
import { useEffect, useRef, useState } from "react";
import {
  buildMbtiType,
  MBTI_AXES,
  splitMbtiType,
  type MbtiSelection,
} from "@/shared/constants/mbti";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { DURATION, REVEAL_EASE, TAP_SPRING } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

export function MbtiStep({ draft, onNext, onChange }: StepProps) {
  const [selection, setSelection] = useState<MbtiSelection>(() => splitMbtiType(draft.mbti));

  const bodyRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useStaggerReveal(bodyRef, { selector: "[data-axis]", startDelay: 160, gap: 70 });

  const mbti = buildMbtiType(selection);

  // 고르는 즉시 draft에 반영한다. 네 축이 다 차기 전에는 undefined로 남는다.
  useEffect(() => {
    onChange({ mbti });
  }, [mbti, onChange]);

  // 네 글자가 완성되는 순간이 이 화면의 보상이라 따로 반응을 준다.
  useEffect(() => {
    if (!mbti || !resultRef.current) return;
    const target = resultRef.current;
    utils.set(target, { scale: 0.86, opacity: 0 });
    animate(target, { scale: [0.86, 1], opacity: [0, 1], ease: TAP_SPRING });
    return () => {
      utils.remove(target);
    };
  }, [mbti]);

  const pick = (axisKey: string, letter: string, el: HTMLElement) => {
    setSelection((prev) => ({ ...prev, [axisKey]: letter }));
    animate(el, { scale: [0.97, 1], duration: DURATION.fade, ease: REVEAL_EASE });
  };

  const answered = Object.keys(selection).length;

  return (
    <StepLayout
      eyebrow="하나만 더 가볍게"
      question="MBTI가 어떻게 되세요?"
      hint="네 가지만 고르면 유형이 완성돼요. 모르면 건너뛰어도 괜찮아요."
      ctaLabel={mbti ? `${mbti}로 다음` : "모르겠어요, 건너뛸게요"}
      onCta={() => onNext({ mbti })}
    >
      <div ref={bodyRef} className="flex flex-col gap-4">
        {MBTI_AXES.map((axis) => (
          <section key={axis.key} data-axis>
            <h2 className="mb-2 text-[14px] font-bold text-gray-900">{axis.question}</h2>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {axis.options.map((option) => {
                const isOn = selection[axis.key] === option.letter;
                return (
                  <button
                    key={option.letter}
                    type="button"
                    role="radio"
                    aria-checked={isOn}
                    onClick={(e) => pick(axis.key, option.letter, e.currentTarget)}
                    className={cn(
                      "rounded-2xl border-2 px-3 py-2.5 text-left transition-colors duration-150",
                      isOn ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
                    )}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "font-mono text-[16px] font-bold",
                          isOn ? "text-brand" : "text-gray-400",
                        )}
                      >
                        {option.letter}
                      </span>
                      <span
                        className={cn(
                          "text-[14px] font-bold",
                          isOn ? "text-brand" : "text-gray-900",
                        )}
                      >
                        {option.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-gray-500">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {/* 완성 전에는 진행 상황을, 완성되면 유형을 크게 보여준다. */}
        {mbti ? (
          <div ref={resultRef} className="rounded-2xl bg-brand-soft py-4 text-center">
            <p className="font-mono text-[26px] leading-none font-bold tracking-[0.1em] text-brand">
              {mbti}
            </p>
          </div>
        ) : (
          <p className="py-2 text-center text-[13px] text-gray-400 tabular-nums">
            {answered}/4 골랐어요
          </p>
        )}
      </div>
    </StepLayout>
  );
}
