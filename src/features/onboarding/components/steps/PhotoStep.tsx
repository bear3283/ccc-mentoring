"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";
import { DURATION, REVEAL_EASE, TAP_SPRING } from "@/shared/lib/anime";
import { nameInitials } from "@/shared/lib/nameInitials";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/** 카드에 쓰기 충분한 크기. 원본을 그대로 담으면 data URL이 지나치게 커진다. */
const MAX_DIMENSION = 512;
const ACCEPTED = "image/png,image/jpeg,image/webp";

/**
 * 고른 이미지를 정사각형으로 잘라 축소한 data URL로 만든다.
 * 카드 아바타가 원형이라 정사각형이 아니면 얼굴이 잘려 보인다.
 */
function toSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 열지 못했습니다."));
      img.onload = () => {
        // 짧은 변을 기준으로 가운데를 정사각형으로 잘라낸다.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const size = Math.min(side, MAX_DIMENSION);

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("이미지를 처리하지 못했습니다."));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoStep({ role, draft, onNext, onChange }: StepProps) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(draft.photoUrl);
  const [error, setError] = useState<string>();

  // 앨범과 카메라는 input 을 따로 둔다.
  // 하나에 capture 속성을 켰다 껐다 하면 기기에 따라 반영이 늦다.
  const pickRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const initials = nameInitials(draft.name);


  // 고르는 즉시 draft에 반영한다. 뒤로 갔다 돌아와도 선택이 남아 있어야 한다.
  useEffect(() => {
    onChange({ photoUrl });
  }, [photoUrl, onChange]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);
    try {
      const url = await toSquareDataUrl(file);
      setPhotoUrl(url);
      if (previewRef.current) {
        animate(previewRef.current, { scale: [0.9, 1], ease: TAP_SPRING });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 불러오지 못했습니다.");
    }
  };

  return (
    <StepLayout
      eyebrow="이제 정말 끝이에요"
      question="사진을 올려볼까요?"
      hint={
        role === "MENTOR"
          ? "얼굴이 보이면 후배가 훨씬 편하게 연락해요. 건너뛰어도 괜찮아요."
          : "선배가 나를 기억하기 쉬워져요. 건너뛰어도 괜찮아요."
      }
      ctaLabel={photoUrl ? "완료" : "사진 없이 완료"}
      onCta={() => onNext({ photoUrl })}
    >
      <div className="flex flex-col items-center pt-2">
        <div ref={previewRef} className="relative">
          {photoUrl ? (
            // 카드에서 보일 모습 그대로 원형으로 미리 보여준다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="선택한 프로필 사진 미리보기"
              className="size-[140px] rounded-full object-cover"
            />
          ) : (
            // 사진이 없으면 이름 글자를 보여준다. 이모지로 대체하지 않는다.
            <div className="flex size-[140px] items-center justify-center rounded-full bg-gray-100">
              <span className="text-[44px] font-bold text-gray-400">{initials}</span>
            </div>
          )}
        </div>

        {!photoUrl && (
          <p className="mt-3 text-center text-[13px] text-gray-400">
            올리지 않으면 이름만 보여요.
          </p>
        )}

        {/* 앨범에서 고르기 */}
        <input
          ref={pickRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            // 같은 파일을 다시 골라도 change가 발생하도록 비운다.
            e.target.value = "";
          }}
        />
        {/* 바로 찍기. capture="user" 가 모바일에서 카메라를 연다. */}
        <input
          ref={captureRef}
          type="file"
          accept={ACCEPTED}
          capture="user"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="mt-6 w-full">
          <div className="grid grid-cols-2 gap-2">
            <PhotoActionButton
              onClick={() => pickRef.current?.click()}
              emoji="🖼️"
              label={photoUrl ? "다시 고르기" : "고르기"}
              description="앨범에서"
            />
            <PhotoActionButton
              onClick={() => captureRef.current?.click()}
              emoji="📷"
              label={photoUrl ? "다시 찍기" : "찍기"}
              description="카메라로"
            />
          </div>

          {photoUrl && (
            <button
              type="button"
              onClick={() => setPhotoUrl(undefined)}
              className="mt-2 h-[48px] w-full rounded-2xl bg-gray-50 text-[15px] font-semibold text-gray-600"
            >
              사진 지우기
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
      </div>
    </StepLayout>
  );
}

/** 고르기 / 찍기 두 갈래를 같은 크기로 나란히 보여준다. */
function PhotoActionButton({
  onClick,
  emoji,
  label,
  description,
}: {
  onClick: () => void;
  emoji: string;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick();
        animate(e.currentTarget, {
          scale: [0.97, 1],
          duration: DURATION.fade,
          ease: REVEAL_EASE,
        });
      }}
      className="flex flex-col items-center gap-1 rounded-2xl bg-brand-soft py-4"
    >
      <span className="text-[24px]" aria-hidden>
        {emoji}
      </span>
      <span className="text-[16px] font-bold text-brand">{label}</span>
      <span className="text-[12px] text-gray-500">{description}</span>
    </button>
  );
}
