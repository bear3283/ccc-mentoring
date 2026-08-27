"use client";

import { animate } from "animejs";
import { useCallback, useRef } from "react";
import { TAP_SPRING } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";

interface CtaButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary";
}

export function CtaButton({
  variant = "primary",
  className,
  disabled,
  children,
  ...props
}: CtaButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 누를 때 살짝 눌리고, 떼면 스프링으로 돌아온다. 토스 버튼의 촉감.
  const press = useCallback(
    (scale: number) => {
      if (disabled || !buttonRef.current) return;
      animate(buttonRef.current, { scale, ease: TAP_SPRING });
    },
    [disabled],
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onPointerDown={() => press(0.97)}
      onPointerUp={() => press(1)}
      onPointerLeave={() => press(1)}
      onPointerCancel={() => press(1)}
      className={cn(
        "h-[54px] w-full rounded-2xl text-[17px] font-bold",
        "transition-colors duration-150",
        variant === "primary" &&
          "bg-brand text-white disabled:bg-gray-100 disabled:text-gray-300",
        variant === "secondary" && "bg-gray-100 text-gray-700 disabled:text-gray-300",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
