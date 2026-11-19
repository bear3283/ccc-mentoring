"use client";

import { useEffect, useRef, useState } from "react";
import { NEW_FRIEND_CONSENT } from "@/shared/constants/privacy";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/**
 * 고3 등록의 마지막 화면. 모두 선택이라 비워도 넘어간다.
 * 대학생은 추천인을 받지 않아 이 화면을 건너뛴다(RoleFunnel 의 skip).
 *
 * 새친구(다니는 교회가 없는 고3)는 채플 당일 따로 맞이해야 해서 다시 묻는다(2026-11-19).
 * 2026-10-26에 출석 교회 질문과 함께 뺐던 것이다. 교회 이름은 지금도 묻지 않는다.
 *
 * 새친구 여부는 종교를 드러내 민감정보(개인정보 보호법 제23조)로 볼 여지가 있다.
 * 그래서 모두에게 필수 동의를 받지 않고, 새친구라고 체크한 사람에게만 이 자리에서
 * 따로 동의를 받는다. 동의하지 않으면 체크를 풀고 그냥 등록할 수 있다.
 *
 * '없음'을 부정적으로 보이지 않게 쓰는 것이 중요하다.
 * 교회를 안 다니는 사람이 여기서 위축되면 행사에 오지 않는다.
 */
export function ExtraStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentee = role === "MENTEE";

  const [referrer, setReferrer] = useState(draft.referrer ?? "");
  const [highSchool, setHighSchool] = useState(draft.highSchool ?? "");
  const [isNewFriend, setIsNewFriend] = useState(draft.isNewFriend ?? false);
  const [consented, setConsented] = useState(draft.newFriendConsent ?? false);
  const [consentOpen, setConsentOpen] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-group]", startDelay: 160, gap: 70 });

  const payload = {
    referrer: referrer.trim() || undefined,
    ...(isMentee
      ? {
          highSchool: highSchool.trim() || undefined,
          isNewFriend,
          // 체크를 풀면 동의도 함께 지운다. 새친구가 아닌 사람에게 민감정보 동의를 남기지 않는다.
          newFriendConsent: isNewFriend && consented,
        }
      : {}),
  };

  useEffect(() => {
    onChange(payload);
    // payload 는 매 렌더 새로 만들어지므로 값들을 직접 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referrer, highSchool, isNewFriend, consented, onChange]);

  const blocked = isMentee && isNewFriend && !consented;

  return (
    <StepLayout
      eyebrow="마지막이에요"
      question="누가 초대해 주었나요?"
      hint="적지 않아도 등록할 수 있어요."
      ctaLabel={blocked ? "새친구 정보 동의가 필요해요" : "등록 완료하기"}
      ctaDisabled={blocked}
      onCta={() => onNext(payload)}
    >
      <div ref={bodyRef} className="flex flex-col gap-5">
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

        {isMentee && (
          <section data-group>
            <Label optional>새친구</Label>
            <button
              type="button"
              role="checkbox"
              aria-checked={isNewFriend}
              onClick={() => {
                setIsNewFriend((prev) => !prev);
                setConsented(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors duration-150",
                isNewFriend ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
              )}
            >
              <Box on={isNewFriend} />
              <span>
                <span className={cn("block text-[15px] font-bold", isNewFriend ? "text-brand" : "text-gray-700")}>
                  아직 다니는 교회가 없어요
                </span>
                <span className="mt-0.5 block text-[13px] text-gray-500">괜찮아요. 새친구로 반갑게 맞이할게요</span>
              </span>
            </button>

            {isNewFriend && (
              <div
                className={cn(
                  "mt-2 rounded-2xl border-2 transition-colors duration-150",
                  consented ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
                )}
              >
                <div className="flex items-center gap-3 p-3.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={consented}
                    onClick={() => setConsented((prev) => !prev)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Box on={consented} />
                    <span className="min-w-0 flex-1 text-[14px] leading-snug font-semibold text-gray-900">
                      {NEW_FRIEND_CONSENT.label}
                    </span>
                  </button>
                  {/* 전문 보기는 체크와 분리한다. 내용을 확인하려다 실수로 동의되면 안 된다. */}
                  <button
                    type="button"
                    onClick={() => setConsentOpen((prev) => !prev)}
                    aria-expanded={consentOpen}
                    className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-gray-500"
                  >
                    {consentOpen ? "접기" : "보기"}
                  </button>
                </div>
                {consentOpen && (
                  <div className="border-t border-gray-200/70 px-4 py-3">
                    <dl className="flex flex-col gap-2">
                      {NEW_FRIEND_CONSENT.table.map((row) => (
                        <div key={row.term}>
                          <dt className="text-[12px] font-bold text-gray-500">{row.term}</dt>
                          <dd className="mt-0.5 text-[13px] leading-relaxed text-gray-700">{row.detail}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-[12px] leading-relaxed text-gray-500">{NEW_FRIEND_CONSENT.notice}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </StepLayout>
  );
}

function Box({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[12px] font-bold text-white",
        on ? "bg-brand" : "bg-gray-300",
      )}
      aria-hidden
    >
      ✓
    </span>
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
