"use client";

import { animate, utils } from "animejs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { loadDraft, type StoredDraft } from "@/features/onboarding/lib/draftStore";
import { ENTER_SPRING } from "@/shared/lib/anime";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [stored, setStored] = useState<StoredDraft | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  // sessionStorage는 서버에서 읽을 수 없어 마운트 후에 가져온다.
  useEffect(() => {
    const found = loadDraft();
    if (!found) {
      // 온보딩을 거치지 않고 직접 들어온 경우 처음으로 돌려보낸다.
      router.replace("/");
      return;
    }
    setStored(found);
  }, [router]);

  useStaggerReveal(bodyRef, { selector: "[data-reveal]", startDelay: 260, gap: 80 });

  // 코드 뱃지는 이 화면의 주인공이라 따로 등장시킨다.
  useEffect(() => {
    if (!stored || !badgeRef.current) return;
    const target = badgeRef.current;
    utils.set(target, { scale: 0.86, opacity: 0 });
    animate(target, { scale: [0.86, 1], opacity: [0, 1], ease: ENTER_SPRING, delay: 120 });
    return () => {
      utils.remove(target);
    };
  }, [stored]);

  // 리다이렉트가 끝나기 전 잠깐의 빈 화면. 여기서 뭔가 보여주면 오히려 깜빡인다.
  if (!stored) return null;

  const isMentee = stored.role === "MENTEE";
  const name = stored.draft.name ?? "";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-6">
      <div ref={bodyRef} className="flex-1 pt-16">
        <p data-reveal className="text-[14px] font-medium text-brand">
          {stored.alreadyRegistered ? "이미 신청하셨어요" : "신청 완료"}
        </p>

        <h1
          data-reveal
          className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900"
        >
          <Name>{name}</Name>님,{" "}
          {stored.alreadyRegistered ? "먼저 접수됐어요" : "접수했어요"}
        </h1>

        <p data-reveal className="mt-2 text-[14px] leading-relaxed text-gray-500">
          {stored.alreadyRegistered
            ? "같은 연락처로 이미 신청한 내역이 있어요. 아래가 그때 받으신 코드예요."
            : isMentee
              ? "잘 맞는 선배를 찾아뒀어요. 아래에서 확인해보세요."
              : "후배가 신청하면 운영자가 연결해 드릴게요."}
        </p>

        {/* 참여코드. 문의할 때 이름 대신 대는 번호라 가장 크게 둔다. */}
        <div ref={badgeRef} className="mt-8">
          <CodeBadge code={stored.participationCode} />
        </div>

        <p data-reveal className="mt-4 text-[13px] leading-relaxed text-gray-500">
          코드를 눌러 복사해 두세요. 잊어버려도{" "}
          <Link href="/lookup" className="font-semibold text-brand">
            이름과 연락처로 조회
          </Link>
          할 수 있어요.
        </p>
      </div>

      <div className="pb-[max(24px,env(safe-area-inset-bottom))]">
        {isMentee ? (
          <Link
            href="/matching/result"
            className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
          >
            매칭 결과 보기
          </Link>
        ) : (
          <Link
            href="/"
            className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-gray-100 text-[17px] font-bold text-gray-700"
          >
            처음으로
          </Link>
        )}
      </div>
    </div>
  );
}
