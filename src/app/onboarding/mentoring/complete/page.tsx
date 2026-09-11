"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Name } from "@/components/ui/Name";
import { loadDraft, type StoredDraft } from "@/features/onboarding/lib/draftStore";
import { InstagramLinks } from "@/features/venue/components/InstagramLinks";
import { MentoringGuide } from "@/features/venue/components/MentoringGuide";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

/**
 * 2단계 완료.
 *
 * 등록 완료 화면과 나누는 이유: 그 화면의 주인공은 참여코드이고,
 * 여기의 주인공은 '이제 무엇이 일어나는가'다.
 */
export default function MentoringCompletePage() {
  const router = useRouter();
  const [stored, setStored] = useState<StoredDraft | null>(null);

  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const found = loadDraft();
    if (!found) {
      router.replace("/");
      return;
    }
    setStored(found);
  }, [router]);

  useStaggerReveal(headRef, { selector: "[data-reveal]", startDelay: 200, gap: 80 });

  if (!stored) return null;

  const isMentee = stored.role === "MENTEE";
  const name = stored.draft.name ?? "";

  // 멘티는 지망 학교들, 멘토는 재학 중인 학교의 CCC를 보여준다.
  const campuses = isMentee
    ? stored.draft.targetCampus
    : stored.draft.currentCampus
      ? [stored.draft.currentCampus]
      : [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white">
      <div ref={headRef} className="px-6 pt-16">
        <p data-reveal className="text-[14px] font-medium text-brand">
          멘토링 신청 완료
        </p>

        <h1
          data-reveal
          className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900"
        >
          <Name>{name}</Name>님, 다 됐어요
        </h1>

        <p data-reveal className="mt-2 text-[14px] leading-relaxed text-gray-500">
          {isMentee
            ? "잘 맞는 선배를 찾아뒀어요. 아래에서 확인해보세요."
            : "후배가 신청하면 연결해 드릴게요. 연락이 오면 반갑게 맞아주세요."}
        </p>
      </div>

      {isMentee && (
        <div className="mt-8 px-6">
          <Link
            href="/matching/result"
            className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
          >
            매칭 결과 보기
          </Link>
        </div>
      )}

      <div className="mt-10">
        <MentoringGuide />
      </div>

      <div className="mt-10">
        <InstagramLinks campuses={campuses} />
      </div>

      <div className="mt-10 px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Link
          href="/"
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-gray-100 text-[16px] font-bold text-gray-700 active:bg-gray-200"
        >
          처음으로
        </Link>
      </div>
    </div>
  );
}
