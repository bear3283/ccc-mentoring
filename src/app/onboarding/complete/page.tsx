"use client";

import { animate, utils } from "animejs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { loadDraft, type StoredDraft } from "@/features/onboarding/lib/draftStore";
import { EVENT_DATE_LABEL, isAfterEvent } from "@/shared/constants/venue";
import { ENTER_SPRING } from "@/shared/lib/anime";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [stored, setStored] = useState<StoredDraft | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inviteRef = useRef<HTMLDivElement>(null);

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

  /*
   * 멘토링 권유 카드가 이 화면의 주인공이라 따로 등장시킨다.
   *
   * 원래는 참여코드가 이 자리였다. 하지만 코드는 나중에 다시 꺼내 보는 값이고,
   * 이 화면에서 실제로 결정해야 하는 것은 "선배를 만날지"다.
   * 등록만 하고 나가면 이 행사의 알맹이를 통째로 지나치게 된다.
   */
  useEffect(() => {
    if (!stored || !inviteRef.current) return;
    const target = inviteRef.current;
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
  const mentoringPath = isMentee
    ? "/onboarding/mentoring/mentee"
    : "/onboarding/mentoring/mentor";

  /*
   * "멘토링"은 참가자에게 익숙한 말이 아니다. 그대로 두면 부가 행사처럼 들린다.
   * 실제로는 선배와 만나 이야기하는 시간이므로, 권유 문구는 이름 대신
   * 무슨 일이 일어나는지로 설명한다.
   */
  /*
   * 멘토링 신청은 채플이 끝난 뒤에도 계속 열어 둔다.
   * 다만 "채플 당일에 만나요"를 그대로 두면 이미 지난 날을 기다리라는 말이 된다.
   * 날짜를 전제하는 문장만 갈라 준다.
   */
  const passed = isAfterEvent();
  const meetingPoint = passed
    ? "서로 편한 때에 만나요"
    : `${EVENT_DATE_LABEL} 정해둔 자리에서 직접 만나요`;

  const invite = isMentee
    ? {
        title: "선배와 이어드릴까요?",
        body: passed
          ? "대학에 먼저 간 CCC 선배와 짝이 되어요. 문자로 인사하고, 편한 때에 만나 이야기 나눠요."
          : `대학에 먼저 간 CCC 선배와 짝이 되어요. 문자로 미리 인사하고, ${EVENT_DATE_LABEL}에 얼굴을 보고 만나요.`,
        points: [
          { emoji: "💬", text: "전공·입시 뒤의 생활, 궁금한 걸 편하게 물어봐요" },
          { emoji: "⛪", text: meetingPoint },
        ],
        cta: "선배 만나러 가기",
      }
    : {
        title: "후배와 이어드릴까요?",
        body: passed
          ? "고3 후배와 짝이 되어요. 문자로 인사하고, 편한 때에 만나 이야기 나눠요."
          : `고3 후배와 짝이 되어요. 문자로 미리 인사하고, ${EVENT_DATE_LABEL}에 얼굴을 보고 만나요.`,
        points: [
          { emoji: "💬", text: "먼저 겪어본 이야기를 들려주세요" },
          { emoji: "⛪", text: meetingPoint },
        ],
        cta: "후배 만나러 가기",
      };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-6">
      <div ref={bodyRef} className="flex-1 pt-16">
        <p data-reveal className="text-[14px] font-medium text-brand">
          {stored.alreadyRegistered ? "이미 등록하셨어요" : "고3채플 등록 완료"}
        </p>

        <h1
          data-reveal
          className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900"
        >
          <Name>{name}</Name>님,{" "}
          {stored.alreadyRegistered ? "먼저 등록되어 있어요" : "등록됐어요"}
        </h1>

        <p data-reveal className="mt-2 text-[14px] leading-relaxed text-gray-500">
          {stored.alreadyRegistered
            ? `같은 연락처로 이미 등록한 내역이 있어요.${passed ? "" : ` ${EVENT_DATE_LABEL}에 뵐게요.`}`
            : passed
              ? "등록이 끝났어요. 그런데 아직 한 가지가 남았어요."
              : `${EVENT_DATE_LABEL}에 뵐게요. 그런데 아직 한 가지가 남았어요.`}
        </p>

        {/* 이 화면에서 실제로 정해야 하는 것. 화면의 절반을 준다. */}
        <div ref={inviteRef} className="mt-6 rounded-3xl bg-brand p-6 text-white">
          <p className="text-[13px] font-semibold text-white/75">등록은 끝났어요</p>
          <h2 className="mt-1.5 text-[22px] leading-[1.35] font-bold tracking-[-0.02em]">
            {invite.title}
          </h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-white/85">{invite.body}</p>

          <ul className="mt-5 flex flex-col gap-2.5">
            {invite.points.map((point) => (
              <li key={point.text} className="flex gap-2.5 text-[14px] leading-relaxed">
                <span aria-hidden>{point.emoji}</span>
                <span className="flex-1 text-white/85">{point.text}</span>
              </li>
            ))}
          </ul>

          <Link
            href={mentoringPath}
            className="mt-6 flex h-[54px] w-full items-center justify-center gap-1.5 rounded-2xl bg-white text-[17px] font-bold text-brand active:bg-white/85"
          >
            {invite.cta}
            <span className="text-[18px]" aria-hidden>
              →
            </span>
          </Link>
          <p className="mt-2.5 text-center text-[13px] text-white/70">
            1분이면 끝나요. 신청은 선착순이 아니에요.
          </p>
        </div>

        {/* 코드는 나중에 다시 꺼내 보는 값이라 참고 크기로 둔다. */}
        <div data-reveal className="mt-7">
          <CodeBadge code={stored.participationCode} size="compact" />
          <p className="mt-2.5 text-[13px] leading-relaxed text-gray-500">
            코드를 눌러 복사해 두세요. 잊어버려도{" "}
            <Link href="/lookup" className="font-semibold text-brand">
              이름과 연락처로 조회
            </Link>
            할 수 있어요.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {/* 채플 장소는 역할과 무관하게 모두 궁금해한다. */}
        <Link
          href="/venue"
          className="flex h-[52px] w-full items-center justify-between rounded-2xl bg-brand-soft px-5 text-[15px] font-bold text-brand active:bg-brand-soft/70"
        >
          <span>채플 장소 · 오시는 길</span>
          <span className="text-[18px]">→</span>
        </Link>

        {/*
          거절 경로는 남겨두되 버튼으로 두지 않는다.
          위 권유와 같은 크기의 버튼을 나란히 놓으면 고민 없이 눌러 지나간다.
        */}
        <Link
          href="/"
          className="mt-1 py-2 text-center text-[14px] font-semibold text-gray-400 active:text-gray-600"
        >
          나중에 할게요
        </Link>
      </div>
    </div>
  );
}
