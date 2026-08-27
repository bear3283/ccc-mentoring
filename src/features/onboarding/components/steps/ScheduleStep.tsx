"use client";

import { useEffect, useRef, useState } from "react";
import { TIME_SLOTS, TIME_SLOT_DEFS, type TimeSlot } from "@/shared/constants/domain";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

const WEEKDAY_SLOTS = TIME_SLOTS.filter((id) => TIME_SLOT_DEFS[id].day === "WEEKDAY");
const WEEKEND_SLOTS = TIME_SLOTS.filter((id) => TIME_SLOT_DEFS[id].day === "WEEKEND");

/**
 * 시간대가 하나도 겹치지 않으면 매칭에서 아예 제외되므로,
 * 적게 고르면 손해라는 것을 화면에서 계속 알려준다.
 */
const RECOMMENDED_MIN = 3;

export function ScheduleStep({ draft, onNext, onChange }: StepProps) {
  const [selected, setSelected] = useState<TimeSlot[]>(draft.availableTimes);

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-group]", startDelay: 160, gap: 90 });


  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    onChange({ availableTimes: selected });
  }, [selected, onChange]);

  const toggle = (slot: TimeSlot) => {
    setSelected((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  };

  const toggleAll = (slots: TimeSlot[]) => {
    const allOn = slots.every((s) => selected.includes(s));
    setSelected((prev) =>
      allOn
        ? prev.filter((s) => !slots.includes(s))
        : [...new Set([...prev, ...slots])],
    );
  };

  return (
    <StepLayout
      eyebrow="마지막 질문이에요"
      question="언제 만날 수 있어요?"
      hint={`겹치는 시간이 없으면 매칭되지 않아요. ${RECOMMENDED_MIN}개 이상 고르길 권해요. 밤 시간대는 온라인으로 만나요.`}
      ctaLabel={
        selected.length === 0
          ? "가능한 시간을 골라주세요"
          : `완료 (${selected.length}개 선택)`
      }
      ctaDisabled={selected.length === 0}
      onCta={() => onNext({ availableTimes: selected })}
    >
      <div ref={bodyRef} className="flex flex-col gap-5">
        <SlotGroup
          title="평일"
          slots={WEEKDAY_SLOTS}
          selected={selected}
          onToggle={toggle}
          onToggleAll={() => toggleAll(WEEKDAY_SLOTS)}
        />
        <SlotGroup
          title="주말"
          slots={WEEKEND_SLOTS}
          selected={selected}
          onToggle={toggle}
          onToggleAll={() => toggleAll(WEEKEND_SLOTS)}
        />

        {/* 고른 개수가 적을 때만 경고한다. 충분하면 조용히 있는다. */}
        {selected.length > 0 && selected.length < RECOMMENDED_MIN && (
          <p className="rounded-xl bg-brand-soft px-4 py-3 text-[13px] leading-relaxed text-brand">
            지금은 {selected.length}개예요. 시간이 적으면 만날 수 있는 상대도 줄어요.
          </p>
        )}
      </div>
    </StepLayout>
  );
}

function SlotGroup({
  title,
  slots,
  selected,
  onToggle,
  onToggleAll,
}: {
  title: string;
  slots: TimeSlot[];
  selected: TimeSlot[];
  onToggle: (slot: TimeSlot) => void;
  onToggleAll: () => void;
}) {
  const allOn = slots.every((s) => selected.includes(s));

  return (
    <section data-group>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-[13px] font-semibold text-brand"
        >
          {allOn ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      {/* 5구간이라 2열 격자가 균형이 맞고, 마지막 항목이 한 칸을 채운다. */}
      <ul role="group" className="grid grid-cols-2 gap-2">
        {slots.map((slot) => {
          const def = TIME_SLOT_DEFS[slot];
          const isOn = selected.includes(slot);

          return (
            <li key={slot}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isOn}
                onClick={() => onToggle(slot)}
                className={cn(
                  "w-full rounded-2xl border-2 px-3 py-2.5 text-left transition-colors duration-150",
                  isOn
                    ? "border-brand bg-brand-soft"
                    : "border-transparent bg-gray-50",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[15px] font-bold",
                      isOn ? "text-brand" : "text-gray-900",
                    )}
                  >
                    {def.label}
                  </span>
                  {/* 대면인지 온라인인지는 참석 가능 여부를 좌우하므로 선택 전에 보여준다. */}
                  {def.onlineOnly && (
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 text-[10px] font-bold",
                        isOn ? "bg-white text-brand" : "bg-gray-200 text-gray-600",
                      )}
                    >
                      온라인
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[12px] text-gray-400 tabular-nums">
                  {def.range}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
