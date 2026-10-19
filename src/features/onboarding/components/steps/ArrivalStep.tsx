"use client";

import { useEffect, useRef, useState } from "react";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import {
  EVENT_ARRIVALS,
  EVENT_ARRIVAL_LABEL,
  EVENT_DATE_LABEL,
  type EventArrival,
} from "@/shared/constants/venue";
import { OptionButton } from "../OptionButton";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 누구와 인사하는지만 역할에 따라 다르다. */
const PARTNER = { MENTEE: "선배", MENTOR: "후배" } as const;

/**
 * 채플 당일(목) 몇 시에 올 수 있는지.
 *
 * 다음 스텝(ScheduleStep)은 채플 뒤에 따로 하는 1:1 멘토링 시간을 묻는다.
 * 이 스텝이 먼저 "목요일은 인사하는 날"이라고 못 박아 두어야
 * 다음 질문을 목요일 시간으로 읽지 않는다.
 */
export function ArrivalStep({ role, draft, onNext, onChange }: StepProps) {
  const [selected, setSelected] = useState<EventArrival | undefined>(draft.eventArrival);

  const optionsRef = useRef<HTMLUListElement>(null);
  useStaggerReveal(optionsRef, { selector: "[data-option]", startDelay: 180 });

  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    if (selected) onChange({ eventArrival: selected });
  }, [selected, onChange]);

  return (
    <StepLayout
      eyebrow={`${EVENT_DATE_LABEL} 채플 날`}
      question="채플 당일, 몇 시에 올 수 있어요?"
      hint={`채플 날에는 매칭된 ${PARTNER[role]}와 얼굴 보고 인사해요. 고른 시간은 매칭된 ${PARTNER[role]}에게 알려줘요.`}
      ctaLabel={selected ? "다음" : "하나만 골라주세요"}
      ctaDisabled={!selected}
      onCta={() => selected && onNext({ eventArrival: selected })}
    >
      <ul ref={optionsRef} role="radiogroup" className="flex flex-col gap-2">
        {EVENT_ARRIVALS.map((id) => (
          <li key={id} data-option>
            <OptionButton
              role="radio"
              size="compact"
              selected={selected === id}
              onSelect={() => setSelected(id)}
              title={EVENT_ARRIVAL_LABEL[id]}
            />
          </li>
        ))}
      </ul>
    </StepLayout>
  );
}
