"use client";

import { useEffect, useRef, useState } from "react";
import { MENTOR_CAPACITY_OPTIONS, type MentorCapacity } from "@/shared/constants/domain";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { OptionButton } from "../OptionButton";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 숫자만 보여주면 얼마나 부담인지 감이 오지 않는다. 고르는 기준을 함께 붙인다. */
const DESCRIPTION: Record<MentorCapacity, string> = {
  1: "한 명에게 집중할게요",
  2: "두 명까지 챙길 수 있어요",
  3: "여러 후배를 도울 여유가 있어요",
};

/**
 * 멘토 전용 — 동시에 맡을 후배 수.
 *
 * 미리 골라 두지 않는다. 기본값을 1명으로 두면 대부분 그대로 넘어가서,
 * 여유가 있는 선배까지 1명으로 묶여 후배가 고를 선배가 줄어든다.
 */
export function CapacityStep({ draft, onNext, onChange }: StepProps) {
  const [selected, setSelected] = useState<MentorCapacity | undefined>(draft.mentorCapacity);

  const optionsRef = useRef<HTMLUListElement>(null);
  useStaggerReveal(optionsRef, { selector: "[data-option]", startDelay: 180 });

  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    if (selected) onChange({ mentorCapacity: selected });
  }, [selected, onChange]);

  return (
    <StepLayout
      eyebrow="거의 다 왔어요"
      question="후배를 몇 명까지 맡을 수 있어요?"
      hint="후배가 선배를 고르면 이 수만큼만 연결돼요. 자리가 다 차면 다른 후배의 목록에서 빠져요."
      ctaLabel={selected ? "다음" : "하나만 골라주세요"}
      ctaDisabled={!selected}
      onCta={() => selected && onNext({ mentorCapacity: selected })}
    >
      <ul ref={optionsRef} role="radiogroup" className="flex flex-col gap-2">
        {MENTOR_CAPACITY_OPTIONS.map((count) => (
          <li key={count} data-option>
            <OptionButton
              role="radio"
              selected={selected === count}
              onSelect={() => setSelected(count)}
              leading={<span className="text-[17px] font-bold text-brand">{count}</span>}
              title={`${count}명`}
              description={DESCRIPTION[count]}
            />
          </li>
        ))}
      </ul>
    </StepLayout>
  );
}
