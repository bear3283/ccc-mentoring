"use client";

import { useEffect, useRef, useState } from "react";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

const CURRENT_YEAR = 2026;
/** 재학 중인 멘토가 실제로 고를 만한 범위. 최신 학번이 위로 오게 한다. */
const ADMISSION_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

/** 010-1234-5678 형태로만 통과시킨다. 연락이 안 되면 등록이 의미가 없다. */
const PHONE_PATTERN = /^01[016-9]-?\d{3,4}-?\d{4}$/;

/** 입력하는 대로 하이픈을 넣어준다. 사용자가 형식을 맞출 필요가 없게. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/**
 * 행사 등록의 기본 정보.
 *
 * 이름과 연락처만 받는다. 성별·고등학교처럼 당장 필요 없는 것을 여기서 물으면
 * 등록 문턱만 높아진다.
 */
export function BasicStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentor = role === "MENTOR";

  const [name, setName] = useState(draft.name ?? "");
  const [contact, setContact] = useState(draft.contact ?? "");
  const [admissionYear, setAdmissionYear] = useState<number | undefined>(draft.admissionYear);

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-group]", startDelay: 160, gap: 70 });

  // 입력하는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 적은 내용이 남아 있어야 한다.
  useEffect(() => {
    onChange({
      name: name.trim() || undefined,
      contact: contact || undefined,
      ...(isMentor ? { admissionYear } : {}),
    });
  }, [name, contact, admissionYear, isMentor, onChange]);

  const phoneValid = PHONE_PATTERN.test(contact);
  const nameValid = name.trim().length >= 2;
  // 학번은 멘토에게만 필수다. 고3 멘티는 아직 학번이 없다.
  const complete = nameValid && phoneValid && (!isMentor || !!admissionYear);

  return (
    <StepLayout
      eyebrow="행사 등록을 시작할게요"
      question="어떻게 불러드릴까요?"
      hint="연락처는 매칭된 상대에게만 보여요."
      ctaLabel={complete ? "다음" : "빈 칸을 채워주세요"}
      ctaDisabled={!complete}
      onCta={() =>
        onNext({
          name: name.trim(),
          contact,
          ...(isMentor ? { admissionYear } : {}),
        })
      }
    >
      <div ref={bodyRef} className="flex flex-col gap-5">
        <section data-group>
          <Label>이름</Label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="김지훈"
            autoComplete="name"
            className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
          />
        </section>

        <section data-group>
          <Label>연락처</Label>
          <input
            type="tel"
            inputMode="numeric"
            value={contact}
            onChange={(e) => setContact(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            autoComplete="tel"
            className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
          />
          {/* 입력을 시작한 뒤에만 지적한다. 처음부터 빨간 글씨를 보여주면 위축된다. */}
          {contact.length > 0 && !phoneValid && (
            <p className="mt-2 text-[13px] text-red-500">
              010으로 시작하는 번호를 정확히 입력해주세요.
            </p>
          )}
        </section>

        {isMentor && (
          <section data-group>
            <Label>학번</Label>
            <ul role="radiogroup" className="flex flex-wrap gap-2">
              {ADMISSION_YEARS.map((year) => (
                <li key={year}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={admissionYear === year}
                    onClick={() => setAdmissionYear(year)}
                    className={cn(
                      "rounded-full border-2 px-4 py-2 text-[14px] font-semibold transition-colors duration-150",
                      admissionYear === year
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-transparent bg-gray-50 text-gray-700",
                    )}
                  >
                    {String(year).slice(2)}학번
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </StepLayout>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[15px] font-bold text-gray-900">{children}</h2>;
}
