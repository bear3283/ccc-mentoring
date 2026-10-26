"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { renderCodeImage } from "../lib/codeImage";

/**
 * 참여코드 이미지를 사진첩에 저장한다.
 *
 * 휴대폰에서는 공유 시트로 넘긴다. iOS 사파리는 다운로드 링크를 누르면 파일 앱으로
 * 가버려 사진첩에 남지 않는데, 공유 시트에는 "이미지 저장"이 있다.
 * 공유를 못 쓰는 곳(PC 등)에서는 파일로 내려받는다.
 *
 * 이미지는 화면이 열릴 때 미리 그려 둔다. iOS 는 버튼을 누른 직후에만 공유를
 * 허락해서, 누른 뒤에 포스터를 불러오며 기다리면 공유가 거부된다.
 */
export function SaveCodeImageButton({
  code,
  name,
  className,
}: {
  code: string;
  name: string;
  className?: string;
}) {
  const [file, setFile] = useState<File>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderCodeImage(code, name)
      .then((blob) => {
        if (!cancelled) setFile(new File([blob], `고3채플_참여코드_${code}.png`, { type: "image/png" }));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [code, name]);

  const handleSave = async () => {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        // 사용자가 공유 시트를 닫은 것은 실패가 아니다.
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  // 그리지 못하는 환경이면 버튼을 숨긴다. 코드는 위에서 복사할 수 있다.
  if (failed) return null;

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={!file}
      // 참여코드는 나중에 결과를 보고 선배를 확인하는 열쇠다. 복사보다 사진첩에 남기는 편이
      // 잃어버리지 않아, 진한 버튼으로 눈에 띄게 둔다.
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 text-[16px] font-bold text-white shadow-sm active:bg-gray-700 disabled:opacity-50",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
        <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      참여코드 이미지로 저장하기
    </button>
  );
}
