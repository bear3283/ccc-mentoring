"use client";

import { useEffect, useRef, useState } from "react";
import { CAMPUSES, type Campus } from "@/shared/constants/domain";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { OptionButton } from "../OptionButton";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 멘티는 3지망까지 고른다. 매칭 가중치 50%가 여기서 갈린다. */
const MAX_CHOICES = 3;

export function CampusStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentee = role === "MENTEE";

  // 멘티는 순서가 곧 지망 순위라 배열을 그대로 쓴다.
  const [choices, setChoices] = useState<Campus[]>(
    isMentee ? draft.targetCampus : draft.currentCampus ? [draft.currentCampus] : [],
  );

  const listRef = useRef<HTMLUListElement>(null);
  useStaggerReveal(listRef, { selector: "[data-option]", startDelay: 160, gap: 26 });

  const toggle = (campus: Campus) => {
    if (!isMentee) {
      setChoices([campus]);
      return;
    }

    setChoices((prev) => {
      // 이미 고른 것을 다시 누르면 해제하고, 뒤 순위가 앞으로 당겨진다.
      if (prev.includes(campus)) return prev.filter((c) => c !== campus);
      if (prev.length >= MAX_CHOICES) return prev;
      return [...prev, campus];
    });
  };


  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    if (isMentee) onChange({ targetCampus: choices });
    else if (choices[0]) onChange({ currentCampus: choices[0] });
  }, [choices, isMentee, onChange]);

  const handleNext = () => {
    if (isMentee) onNext({ targetCampus: choices });
    else onNext({ currentCampus: choices[0] });
  };

  const ctaLabel = isMentee
    ? choices.length === 0
      ? "1지망부터 골라주세요"
      : choices.length < MAX_CHOICES
        ? `다음 (${choices.length}/${MAX_CHOICES})`
        : "다음"
    : choices.length === 0
      ? "캠퍼스를 골라주세요"
      : "다음";

  return (
    <StepLayout
      eyebrow={isMentee ? "가장 중요한 질문이에요" : "어디에서 활동하고 계세요?"}
      question={isMentee ? "가고 싶은 캠퍼스는?" : "지금 다니는 캠퍼스는?"}
      hint={
        isMentee
          ? "누른 순서가 곧 지망 순위예요. 3개까지 고를 수 있어요."
          : "이 캠퍼스를 지망하는 후배와 이어드려요."
      }
      ctaLabel={ctaLabel}
      // 멘티는 최소 1지망만 있어도 넘어갈 수 있게 한다. 3개를 강제하면 이탈이 는다.
      ctaDisabled={choices.length === 0}
      onCta={handleNext}
    >
      <ul ref={listRef} role={isMentee ? "group" : "radiogroup"} className="flex flex-col gap-2">
        {CAMPUSES.map((campus) => {
          const rank = choices.indexOf(campus);
          const selected = rank !== -1;

          return (
            <li key={campus} data-option>
              <OptionButton
                role={isMentee ? "checkbox" : "radio"}
                selected={selected}
                onSelect={() => toggle(campus)}
                size="compact"
                // 지망 순위를 숫자로 보여줘야 "몇 지망으로 넣었더라"를 되짚지 않는다.
                leading={isMentee ? (selected ? `${rank + 1}` : "") : undefined}
                title={campus}
                trailing={
                  isMentee && !selected && choices.length >= MAX_CHOICES ? "3개까지" : undefined
                }
              />
            </li>
          );
        })}
      </ul>
    </StepLayout>
  );
}
