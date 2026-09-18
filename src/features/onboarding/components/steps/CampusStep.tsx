"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CAMPUSES_BY_REGION,
  REGIONS,
  regionOf,
  type Campus,
  type Region,
} from "@/shared/constants/domain";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { OptionButton } from "../OptionButton";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 멘티는 3지망까지 고른다. 매칭 가중치가 가장 큰 항목이다. */
const MAX_CHOICES = 3;

const CURRENT_YEAR = new Date().getFullYear();
const ADMISSION_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

export function CampusStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentee = role === "MENTEE";

  // 학번은 멘토에게만 묻는다. 고3은 아직 학번이 없다.
  // 학교와 함께 받아야 "○○대 23학번"이 한 화면에서 완성된다.
  const [admissionYear, setAdmissionYear] = useState<number | undefined>(draft.admissionYear);

  // 멘티는 순서가 곧 지망 순위라 배열을 그대로 쓴다.
  const [choices, setChoices] = useState<Campus[]>(
    isMentee ? draft.targetCampus : draft.currentCampus ? [draft.currentCampus] : [],
  );

  /**
   * 전국 캠퍼스는 100개에 가깝다. 한 목록으로 늘어놓으면 찾지 못한다.
   * 이미 고른 학교가 있으면 그 지역부터 열어 준다.
   */
  const [region, setRegion] = useState<Region>(
    () => (choices[0] && regionOf(choices[0])) || "서울",
  );
  const [query, setQuery] = useState("");

  const listRef = useRef<HTMLUListElement>(null);
  // 지역을 바꿀 때마다 목록이 통째로 바뀌므로 등장 애니메이션도 다시 재생한다.
  useStaggerReveal(listRef, {
    selector: "[data-option]",
    startDelay: 60,
    gap: 18,
    replayKey: `${region}-${query}`,
  });

  /**
   * 검색어가 있으면 지역을 무시하고 전국에서 찾는다.
   * "한동대"를 아는 사람에게 경상 탭을 먼저 누르게 할 이유가 없다.
   */
  const visible = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return CAMPUSES_BY_REGION[region] as readonly Campus[];

    return REGIONS.flatMap((r) => CAMPUSES_BY_REGION[r] as readonly Campus[]).filter(
      (campus) => campus.includes(keyword),
    );
  }, [region, query]);

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
    else onChange({ currentCampus: choices[0], admissionYear });
  }, [choices, admissionYear, isMentee, onChange]);

  const handleNext = () => {
    if (isMentee) onNext({ targetCampus: choices });
    else onNext({ currentCampus: choices[0], admissionYear });
  };

  const ctaLabel = isMentee
    ? choices.length === 0
      ? "1지망부터 골라주세요"
      : choices.length < MAX_CHOICES
        ? `다음 (${choices.length}/${MAX_CHOICES})`
        : "다음"
    : choices.length === 0
      ? "학교를 골라주세요"
      : !admissionYear
        ? "학번을 골라주세요"
        : "다음";

  return (
    <StepLayout
      eyebrow={isMentee ? "가장 중요한 질문이에요" : "어디에서 활동하고 계세요?"}
      question={isMentee ? "가고 싶은 학교는?" : "지금 다니는 학교는?"}
      hint={
        isMentee
          ? "누른 순서가 곧 지망 순위예요. 3개까지 고를 수 있어요."
          : "이 학교를 지망하는 후배와 이어드려요."
      }
      ctaLabel={ctaLabel}
      // 멘티는 최소 1지망만 있어도 넘어갈 수 있게 한다. 3개를 강제하면 이탈이 는다.
      // 멘토는 학번까지 있어야 프로필이 완성된다.
      ctaDisabled={choices.length === 0 || (!isMentee && !admissionYear)}
      onCta={handleNext}
    >
      {/* 고른 학교를 위에 고정해 둔다. 지역을 옮겨다녀도 놓치지 않는다. */}
      {isMentee && choices.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {choices.map((campus, i) => (
            <button
              key={campus}
              type="button"
              onClick={() => toggle(campus)}
              className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold text-white"
            >
              <span className="opacity-70">{i + 1}지망</span>
              {campus}
              <span className="text-[14px] leading-none opacity-70">×</span>
            </button>
          ))}
        </div>
      )}

      {/*
        고른 학교와 학번을 목록 위에 둔다. 아래에 두면 캠퍼스 100개를 지나
        스크롤해야 나와서, "학번을 골라주세요"라는 버튼만 보고 길을 잃는다.
      */}
      {!isMentee && choices.length > 0 && (
        <div className="mb-3 rounded-2xl bg-brand-soft px-4 py-3.5">
          <p className="text-[15px] font-bold text-brand">{choices[0]}</p>
          <ul role="radiogroup" className="mt-2.5 flex flex-wrap gap-1.5">
            {ADMISSION_YEARS.map((year) => (
              <li key={year}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={admissionYear === year}
                  onClick={() => setAdmissionYear(year)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors duration-150",
                    admissionYear === year
                      ? "bg-brand text-white"
                      : "bg-white text-gray-600",
                  )}
                >
                  {String(year).slice(2)}학번
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        type="search"
        inputMode="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="학교 이름으로 찾기"
        className="mb-3 h-11 w-full rounded-xl bg-gray-100 px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-brand/40"
      />

      {/* 검색 중에는 지역 탭이 의미가 없다. */}
      {!query.trim() && (
        <div className="-mx-5 mb-3 overflow-x-auto px-5">
          <div className="flex w-max gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${
                  r === region
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 active:bg-gray-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul
        ref={listRef}
        role={isMentee ? "group" : "radiogroup"}
        className="flex flex-col gap-2"
      >
        {visible.map((campus) => {
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

        {visible.length === 0 && (
          <li className="py-10 text-center text-[14px] text-gray-400">
            &lsquo;{query.trim()}&rsquo; 와 맞는 학교가 없어요
          </li>
        )}
      </ul>
    </StepLayout>
  );
}
