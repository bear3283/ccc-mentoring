"use client";

import { useEffect, useRef, useState } from "react";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/**
 * 출석하는 교회.
 *
 * 다니는 교회가 없는 사람을 '새친구'로 구분해 둔다.
 * 행사 당일 따로 맞이하고 챙겨야 하는 분들이라 등록 단계에서 미리 안다.
 *
 * '없음'을 부정적으로 보이지 않게 쓰는 것이 중요하다.
 * 교회를 안 다니는 사람이 여기서 위축되면 행사에 오지 않는다.
 */
export function ChurchStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentee = role === "MENTEE";

  const [isNewFriend, setIsNewFriend] = useState(draft.isNewFriend ?? false);
  const [church, setChurch] = useState(draft.church ?? "");
  const [referrer, setReferrer] = useState(draft.referrer ?? "");
  const [highSchool, setHighSchool] = useState(draft.highSchool ?? "");

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-group]", startDelay: 160, gap: 70 });

  const payload = {
    // 새친구를 고르면 교회 이름은 지운다. 둘이 같이 남으면 집계가 어긋난다.
    church: isNewFriend ? undefined : church.trim() || undefined,
    isNewFriend,
    referrer: referrer.trim() || undefined,
    ...(isMentee ? { highSchool: highSchool.trim() || undefined } : {}),
  };

  useEffect(() => {
    onChange(payload);
    // payload 는 매 렌더 새로 만들어지므로 값들을 직접 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [church, isNewFriend, referrer, highSchool, onChange]);

  // 교회를 적었거나, 새친구라고 밝혔으면 넘어갈 수 있다.
  const complete = isNewFriend || church.trim().length > 0;

  return (
    <StepLayout
      eyebrow="마지막이에요"
      question="출석하는 교회가 있나요?"
      hint="행사 당일 안내를 돕기 위해 여쭤봐요."
      ctaLabel={complete ? "등록 완료하기" : "교회를 알려주세요"}
      ctaDisabled={!complete}
      onCta={() => onNext(payload)}
    >
      <div ref={bodyRef} className="flex flex-col gap-5">
        <section data-group>
          <input
            type="text"
            value={church}
            onChange={(e) => {
              setChurch(e.target.value);
              // 교회 이름을 적기 시작하면 새친구 표시는 자동으로 풀린다.
              if (e.target.value.trim()) setIsNewFriend(false);
            }}
            placeholder="신길교회"
            className={cn(
              "h-[52px] w-full rounded-2xl px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300",
              isNewFriend ? "bg-gray-100 text-gray-400" : "bg-gray-50 focus:bg-brand-soft",
            )}
            disabled={isNewFriend}
          />

          <button
            type="button"
            role="checkbox"
            aria-checked={isNewFriend}
            onClick={() => {
              setIsNewFriend((prev) => !prev);
              setChurch("");
            }}
            className={cn(
              "mt-2 flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors duration-150",
              isNewFriend
                ? "border-brand bg-brand-soft"
                : "border-transparent bg-gray-50",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[12px] font-bold text-white",
                isNewFriend ? "bg-brand" : "bg-gray-300",
              )}
            >
              ✓
            </span>
            <span>
              <span
                className={cn(
                  "block text-[15px] font-bold",
                  isNewFriend ? "text-brand" : "text-gray-700",
                )}
              >
                아직 다니는 교회가 없어요
              </span>
              <span className="mt-0.5 block text-[13px] text-gray-500">
                괜찮아요. 새친구로 반갑게 맞이할게요
              </span>
            </span>
          </button>
        </section>

        <section data-group>
          <Label optional>추천인</Label>
          <input
            type="text"
            value={referrer}
            onChange={(e) => setReferrer(e.target.value)}
            placeholder="초대해 준 분의 이름"
            className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
          />
        </section>

        {isMentee && (
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
        )}
      </div>
    </StepLayout>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <h2 className="mb-2 flex items-baseline gap-1.5 text-[15px] font-bold text-gray-900">
      {children}
      {optional && <span className="text-[13px] font-medium text-gray-400">선택</span>}
    </h2>
  );
}
