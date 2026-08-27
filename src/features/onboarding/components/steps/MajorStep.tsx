"use client";

import { useEffect, useRef, useState } from "react";
import { CAREERS, MAJORS, type Career, type Major } from "@/shared/constants/domain";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 학과·진로 각각의 상한. 하나만 골라도 넘어간다. */
const MAX_CHOICES = 3;

/**
 * 학과와 진로를 한 스텝에서 받는다.
 * 둘 다 합쳐 가중치 15%뿐이라 스텝을 나누면 체감 길이만 늘어난다.
 * 항목이 많아 리스트 대신 칩(chip) 격자로 배치했다.
 */
export function MajorStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentee = role === "MENTEE";

  const [majors, setMajors] = useState<Major[]>(
    isMentee ? draft.targetMajors : draft.currentMajors,
  );
  const [careers, setCareers] = useState<Career[]>(
    isMentee ? draft.targetCareers : draft.careerPaths,
  );

  /** 최대 개수까지만 담는 토글. 이미 담긴 것을 누르면 빠진다. */
  function makeToggle<T>(setter: React.Dispatch<React.SetStateAction<T[]>>) {
    return (item: T) =>
      setter((prev) => {
        if (prev.includes(item)) return prev.filter((x) => x !== item);
        if (prev.length >= MAX_CHOICES) return prev;
        return [...prev, item];
      });
  }

  const toggleMajor = makeToggle(setMajors);
  const toggleCareer = makeToggle(setCareers);

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-group]", startDelay: 160, gap: 90 });


  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    if (isMentee) onChange({ targetMajors: majors, targetCareers: careers });
    else onChange({ currentMajors: majors, careerPaths: careers });
  }, [majors, careers, isMentee, onChange]);

  const handleNext = () => {
    if (isMentee) onNext({ targetMajors: majors, targetCareers: careers });
    else onNext({ currentMajors: majors, careerPaths: careers });
  };

  const complete = majors.length > 0 && careers.length > 0;

  return (
    <StepLayout
      eyebrow="거의 다 왔어요"
      question={isMentee ? "어떤 공부를 하고 싶어요?" : "어떤 공부를 하고 있나요?"}
      hint={
        isMentee
          ? "같은 길을 먼저 걸어본 선배를 찾아드려요."
          : "같은 길을 준비하는 후배와 이어드려요."
      }
      ctaLabel={complete ? "다음" : "학과와 진로를 골라주세요"}
      ctaDisabled={!complete}
      onCta={handleNext}
    >
      <div ref={bodyRef} className="flex flex-col gap-6">
        <section data-group>
          <GroupTitle
            label={isMentee ? "희망 학과" : "전공"}
            count={majors.length}
          />
          <ul role="group" className="flex flex-wrap gap-2">
            {MAJORS.map((m) => (
              <li key={m}>
                <Chip
                  selected={majors.includes(m)}
                  blocked={!majors.includes(m) && majors.length >= MAX_CHOICES}
                  onSelect={() => toggleMajor(m)}
                  label={m}
                />
              </li>
            ))}
          </ul>
        </section>

        <section data-group>
          <GroupTitle
            label={isMentee ? "희망 진로" : "준비 중인 진로"}
            count={careers.length}
          />
          <ul role="group" className="flex flex-wrap gap-2">
            {CAREERS.map((c) => (
              <li key={c}>
                <Chip
                  selected={careers.includes(c)}
                  blocked={!careers.includes(c) && careers.length >= MAX_CHOICES}
                  onSelect={() => toggleCareer(c)}
                  label={c}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </StepLayout>
  );
}

/** 몇 개 골랐는지 항상 보여야 "최대 3개"라는 규칙이 체감된다. */
function GroupTitle({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2">
      <h2 className="text-[15px] font-bold text-gray-900">{label}</h2>
      <span className="text-[13px] font-medium text-gray-400 tabular-nums">
        {count}/{MAX_CHOICES}
      </span>
    </div>
  );
}

function Chip({
  selected,
  blocked,
  onSelect,
  label,
}: {
  selected: boolean;
  blocked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={blocked}
      onClick={() => !blocked && onSelect()}
      className={cn(
        "rounded-full border-2 px-3.5 py-2 text-[14px] font-semibold transition-colors duration-150",
        selected
          ? "border-brand bg-brand-soft text-brand"
          : "border-transparent bg-gray-50 text-gray-700",
        blocked && "opacity-40",
      )}
    >
      {label}
    </button>
  );
}
