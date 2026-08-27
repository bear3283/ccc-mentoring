"use client";

import { useEffect, useRef, useState } from "react";
import { GENDERS, type Gender } from "@/shared/constants/domain";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

const CURRENT_YEAR = 2026;
/** 재학 중인 멘토가 실제로 고를 만한 범위. 최신 학번이 위로 오게 한다. */
const ADMISSION_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

const GENDER_LABEL: Record<Gender, string> = { MALE: "남자", FEMALE: "여자" };

/** 010-1234-5678 형태로만 통과시킨다. 매칭돼도 연락이 안 되면 의미가 없다. */
const PHONE_PATTERN = /^01[016-9]-?\d{3,4}-?\d{4}$/;

/** 입력하는 대로 하이픈을 넣어준다. 사용자가 형식을 맞출 필요가 없게. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function ProfileStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentor = role === "MENTOR";

  const [name, setName] = useState(draft.name ?? "");
  const [gender, setGender] = useState<Gender | undefined>(draft.gender);
  const [contact, setContact] = useState(draft.contact ?? "");
  const [admissionYear, setAdmissionYear] = useState<number | undefined>(draft.admissionYear);
  const [highSchool, setHighSchool] = useState(draft.highSchool ?? "");
  const [referrer, setReferrer] = useState(draft.referrer ?? "");

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-group]", startDelay: 160, gap: 70 });

  // 입력하는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 적은 내용이 남아 있어야 한다.
  useEffect(() => {
    onChange({
      name: name.trim() || undefined,
      gender,
      contact: contact || undefined,
      highSchool: highSchool.trim() || undefined,
      referrer: referrer.trim() || undefined,
      ...(isMentor ? { admissionYear } : {}),
    });
  }, [name, gender, contact, highSchool, referrer, admissionYear, isMentor, onChange]);

  const phoneValid = PHONE_PATTERN.test(contact);
  const nameValid = name.trim().length >= 2;
  // 학번은 멘토에게만 필수다. 고3 멘티는 아직 학번이 없다.
  const complete = nameValid && !!gender && phoneValid && (!isMentor || !!admissionYear);

  return (
    <StepLayout
      eyebrow="연락받을 방법만 알려주세요"
      question="어떻게 연락드리면 될까요?"
      hint="연락처는 매칭된 상대에게만 보여요."
      ctaLabel={complete ? "다음" : "빈 칸을 채워주세요"}
      ctaDisabled={!complete}
      onCta={() =>
        onNext({
          name: name.trim(),
          gender,
          contact,
          // 빈 문자열 대신 undefined 로 넘겨야 "입력 안 함"과 구분된다.
          highSchool: highSchool.trim() || undefined,
          referrer: referrer.trim() || undefined,
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

        <section data-group>
          <Label>성별</Label>
          <div role="radiogroup" className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={gender === g}
                onClick={() => setGender(g)}
                className={cn(
                  "h-[52px] flex-1 rounded-2xl border-2 text-[16px] font-semibold transition-colors duration-150",
                  gender === g
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-transparent bg-gray-50 text-gray-700",
                )}
              >
                {GENDER_LABEL[g]}
              </button>
            ))}
          </div>
        </section>

        <section data-group>
          <Label optional>출신 고등학교</Label>
          <input
            type="text"
            value={highSchool}
            onChange={(e) => setHighSchool(e.target.value)}
            placeholder="한빛고등학교"
            className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
          />
        </section>

        <section data-group>
          <Label optional>추천인</Label>
          <input
            type="text"
            value={referrer}
            onChange={(e) => setReferrer(e.target.value)}
            placeholder="소개해 준 분의 이름"
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
      </div>
    </StepLayout>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <h2 className="mb-2 flex items-baseline gap-1.5 text-[15px] font-bold text-gray-900">
      {children}
      {/* 필수와 선택을 구분해야 어디까지 채워야 하는지 알 수 있다. */}
      {optional && <span className="text-[13px] font-medium text-gray-400">선택</span>}
    </h2>
  );
}
