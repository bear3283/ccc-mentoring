"use client";

import { useEffect, useState } from "react";
import { GENDERS, GENDER_LABEL, type Gender } from "@/shared/constants/domain";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 누구와 이어지는지만 역할에 따라 다르다. */
const PARTNER = { MENTEE: "선배", MENTOR: "후배" } as const;

/**
 * 성별을 받기 전에 등록한 사람만 멘토링 신청 첫머리에서 보는 스텝.
 *
 * 매칭은 같은 성별끼리만 한다. 성별이 비어 있으면 매칭 후보가 되지 않아,
 * 신청을 마쳐도 선배를 한 명도 못 보게 된다. 등록 화면(BasicStep)에서
 * 성별을 받은 사람은 RoleFunnel 이 이 스텝을 건너뛴다.
 */
export function GenderStep({ role, draft, onNext, onChange }: StepProps) {
  const [gender, setGender] = useState<Gender | undefined>(draft.gender);

  useEffect(() => {
    if (gender) onChange({ gender });
  }, [gender, onChange]);

  return (
    <StepLayout
      eyebrow="멘토링 신청"
      question="성별을 알려주세요"
      hint={`같은 성별의 ${PARTNER[role]}와 이어드려요.`}
      ctaLabel={gender ? "다음" : "하나만 골라주세요"}
      ctaDisabled={!gender}
      onCta={() => gender && onNext({ gender })}
    >
      <GenderChoice value={gender} onChange={setGender} />
    </StepLayout>
  );
}

/** 남·여 두 칸. 등록 화면과 위 스텝이 같이 쓴다. */
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
