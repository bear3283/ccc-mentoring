"use client";

import { GENDERS, GENDER_LABEL, type Gender } from "@/shared/constants/domain";
import { cn } from "@/shared/lib/cn";

/** 남·여 두 칸. 등록 화면(BasicStep)에서 쓴다. 매칭은 같은 성별끼리만 한다. */
export function GenderChoice({
  value,
  onChange,
}: {
  value: Gender | undefined;
  onChange: (gender: Gender) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2">
      {GENDERS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={cn(
            "h-[52px] rounded-2xl border-2 text-[16px] font-bold transition-colors duration-150",
            value === g
              ? "border-brand bg-brand-soft text-brand"
              : "border-transparent bg-gray-50 text-gray-700",
          )}
        >
          {GENDER_LABEL[g]}
        </button>
      ))}
    </div>
  );
}
