"use client";

import { animate } from "animejs";
import { DURATION, REVEAL_EASE } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";

interface OptionButtonProps {
  selected: boolean;
  /** radio = 하나만, checkbox = 여러 개 */
  role: "radio" | "checkbox";
  onSelect: () => void;
  /** 왼쪽 원형 자리. 이모지, 지망 순위 뱃지 등이 들어간다. */
  leading?: React.ReactNode;
  title: string;
  description?: string;
  /** 오른쪽 끝에 붙는 보조 텍스트 */
  trailing?: string;
  size?: "default" | "compact";
}

/**
 * 온보딩 전 스텝이 공유하는 선택지 한 줄.
 * 스텝마다 이 마크업을 복사하면 간격·선택 색이 조금씩 어긋나므로 한곳에 모은다.
 */
export function OptionButton({
  selected,
  role,
  onSelect,
  leading,
  title,
  description,
  trailing,
  size = "default",
}: OptionButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onSelect();
    // 누른 항목만 살짝 반응시켜 어디를 골랐는지 즉시 알린다.
    animate(e.currentTarget, {
      scale: [0.98, 1],
      duration: DURATION.fade,
      ease: REVEAL_EASE,
    });
  };

  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl border-2 text-left",
        "transition-colors duration-150",
        size === "default" ? "p-3.5" : "px-3.5 py-2.5",
        selected ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
      )}
    >
      {leading && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full",
            size === "default" ? "size-11 text-[22px]" : "size-8 text-[15px] font-bold",
            selected ? "bg-white" : "bg-white/70",
          )}
          aria-hidden
        >
          {leading}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-bold text-gray-900",
            size === "default" ? "text-[17px]" : "text-[15px]",
          )}
        >
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-[14px] text-gray-500">{description}</span>
        )}
      </span>

      {trailing && (
        <span className="shrink-0 text-[13px] text-gray-400">{trailing}</span>
      )}

      {/* 선택 표시 자리는 항상 차지해 두어 고를 때 레이아웃이 흔들리지 않는다. */}
      <span className="size-6 shrink-0">
        {selected && (
          <svg viewBox="0 0 24 24" className="size-6 text-brand" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5.03 7.53-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.47-5.47a.75.75 0 0 1 1.06 1.06Z" />
          </svg>
        )}
      </span>
    </button>
  );
}
