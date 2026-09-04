"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";
import {
  AGE_NOTICE,
  CONSENT_ITEMS,
  CONSENT_VERSION,
  type ConsentItem,
} from "@/shared/constants/privacy";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { DURATION, REVEAL_EASE } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/**
 * 개인정보 동의.
 *
 * 이름·연락처를 묻는 프로필 스텝 바로 앞에 둔다. 개인정보를 요청하기 전에
 * 동의를 받아야 하고, 사진·학교도 뒤에 오므로 이 위치가 전부를 덮는다.
 *
 * 두 항목을 하나로 합치지 않는 이유: 수집·이용과 제3자 제공은 성격이 다른
 * 동의라 각각 받아야 한다. 한 번에 묶으면 무엇에 동의했는지 불분명해진다.
 */
export function ConsentStep({ draft, onNext, onChange }: StepProps) {
  const [agreed, setAgreed] = useState<Record<string, boolean>>(
    draft.consentedAt ? { collect: true, thirdParty: true } : {},
  );
  const [expanded, setExpanded] = useState<string>();

  const listRef = useRef<HTMLUListElement>(null);
  useStaggerReveal(listRef, { selector: "[data-item]", startDelay: 160, gap: 90 });

  const allAgreed = CONSENT_ITEMS.every((item) => agreed[item.id]);

  // 동의 상태를 draft에 반영해 두면 뒤로 갔다 와도 유지된다.
  useEffect(() => {
    onChange({
      consentedAt: allAgreed ? new Date().toISOString() : undefined,
      consentVersion: allAgreed ? CONSENT_VERSION : undefined,
    });
  }, [allAgreed, onChange]);

  const toggle = (id: string, el: HTMLElement) => {
    setAgreed((prev) => ({ ...prev, [id]: !prev[id] }));
    animate(el, { scale: [0.98, 1], duration: DURATION.fade, ease: REVEAL_EASE });
  };

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreed(Object.fromEntries(CONSENT_ITEMS.map((i) => [i.id, next])));
  };

  return (
    <StepLayout
      eyebrow="연락처를 받기 전에"
      question="개인정보 동의가 필요해요"
      hint="어떤 정보를 왜 받는지 확인하고 동의해주세요."
      ctaLabel={allAgreed ? "동의하고 계속하기" : "모두 동의해주세요"}
      ctaDisabled={!allAgreed}
      onCta={() =>
        onNext({
          consentedAt: new Date().toISOString(),
          consentVersion: CONSENT_VERSION,
        })
      }
    >
      <button
        type="button"
        onClick={toggleAll}
        className={cn(
          "mb-3 flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left",
          "transition-colors duration-150",
          allAgreed ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
        )}
      >
        <CheckMark on={allAgreed} />
        <span
          className={cn(
            "text-[16px] font-bold",
            allAgreed ? "text-brand" : "text-gray-900",
          )}
        >
          모두 동의합니다
        </span>
      </button>

      <ul ref={listRef} className="flex flex-col gap-2">
        {CONSENT_ITEMS.map((item) => (
          <li key={item.id} data-item>
            <ConsentRow
              item={item}
              checked={!!agreed[item.id]}
              open={expanded === item.id}
              onToggleCheck={(el) => toggle(item.id, el)}
              onToggleOpen={() =>
                setExpanded((prev) => (prev === item.id ? undefined : item.id))
              }
            />
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[13px] leading-relaxed text-gray-400">
        {AGE_NOTICE}
        <br />
        동의 내용은 신청 시각과 함께 기록돼요.
      </p>
    </StepLayout>
  );
}

function ConsentRow({
  item,
  checked,
  open,
  onToggleCheck,
  onToggleOpen,
}: {
  item: ConsentItem;
  checked: boolean;
  open: boolean;
  onToggleCheck: (el: HTMLElement) => void;
  onToggleOpen: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 transition-colors duration-150",
        checked ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
      )}
    >
      <div className="flex items-center gap-3 p-3.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={(e) => onToggleCheck(e.currentTarget)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <CheckMark on={checked} />
          <span className="min-w-0 flex-1">
            <span className="text-[13px] font-bold text-brand">필수</span>
            <span className="mt-0.5 block text-[15px] leading-snug font-semibold text-gray-900">
              {item.label}
            </span>
          </span>
        </button>

        {/* 전문 보기는 체크와 분리한다. 내용을 확인하려다 실수로 동의되면 안 된다. */}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-gray-500"
        >
          {open ? "접기" : "보기"}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-200/70 px-4 py-3">
          <dl className="flex flex-col gap-2">
            {item.table.map((row) => (
              <div key={row.term}>
                <dt className="text-[12px] font-bold text-gray-500">{row.term}</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-gray-700">
                  {row.detail}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] leading-relaxed text-gray-500">{item.notice}</p>
        </div>
      )}
    </div>
  );
}

function CheckMark({ on }: { on: boolean }) {
  return (
    <span className="size-6 shrink-0" aria-hidden>
      <svg
        viewBox="0 0 24 24"
        className={cn("size-6", on ? "text-brand" : "text-gray-300")}
        fill="currentColor"
      >
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5.03 7.53-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.47-5.47a.75.75 0 0 1 1.06 1.06Z" />
      </svg>
    </span>
  );
}
