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
            : "후배가 선배님을 고르면 연결돼요. 후배가 먼저 문자를 보낼 거예요."}
        </p>
      </div>

      <div className="mt-8 px-6">
        {isMentee ? (
          <Link
            href="/matching/result"
            className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
          >
            매칭 결과 보기
          </Link>
        ) : (
          /*
           * 멘토에게는 알림이 가지 않는다. 확인할 길이 없으면 "신청했는데
           * 아무 일도 안 일어난다"로 남는다. 직접 볼 수 있는 통로를 준다.
           */
          <>
            <Link
              href="/mentor/match"
              className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
            >
              연결된 후배 확인하기
            </Link>
            <p className="mt-2.5 text-center text-[13px] leading-relaxed text-gray-400">
              아직 후배가 고르기 전이면 비어 있어요.
              <br />
              참여코드로 언제든 다시 확인할 수 있어요.
            </p>
          </>
        )}
      </div>

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
