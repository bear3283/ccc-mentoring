"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Name } from "@/components/ui/Name";
import type { PublicMatchResult } from "@/features/matching/model/types";
import { loadDraft } from "@/features/onboarding/lib/draftStore";
import { MentoringGuide } from "@/features/venue/components/MentoringGuide";
import { PERSONAS } from "@/shared/constants/persona";
import { nameInitials } from "@/shared/lib/nameInitials";

/**
 * 매칭이 성사된 뒤의 화면.
 *
 * 카드 목록 안에서 연락처를 펼쳐 보여주던 것을 따로 떼어냈다. 목록 화면에서는
 * "고르는 일"과 "연락하는 일"이 섞여서, 정작 지금 해야 할 한 가지(문자 보내기)가
 * 카드 하나의 일부처럼 보였다.
 *
 * 이 화면의 일은 하나다 — 문자를 보내게 하는 것. 그래서 버튼을 가장 크게 두고,
 * 아래 3단계 안내의 1단계를 같은 것으로 묶어 "지금 할 일"로 표시한다.
 */

type State =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "ready"; myName: string; mentor: PublicMatchResult["mentor"]; contact: string };

export default function SettledMatchPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const stored = loadDraft();
    if (!stored || stored.role !== "MENTEE") {
      router.replace("/");
      return;
    }

    const code = stored.participationCode;
    const myName = stored.draft.name ?? "";

    void (async () => {
      // 매칭 결과를 먼저 읽어 확정된 선배가 있는지 본다.
      const matchRes = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participationCode: code }),
      });
      const matchBody = (await matchRes.json()) as {
        results?: PublicMatchResult[];
        settledMentorId?: string;
      };

      const mentor = matchBody.results?.find(
        (r) => r.mentor.id === matchBody.settledMentorId,
      )?.mentor;
      if (!matchRes.ok || !mentor) {
        setState({ kind: "none" });
        return;
      }

      // 연락처는 따로 요청해야 내려온다. 이미 확정된 상대라 다시 열린다.
      const revealRes = await fetch("/api/match/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participationCode: code, mentorId: mentor.id }),
      });
      const revealBody = (await revealRes.json()) as { contact?: string };
      if (!revealRes.ok || !revealBody.contact) {
        setState({ kind: "none" });
        return;
      }

      setState({ kind: "ready", myName, mentor, contact: revealBody.contact });
    })();
  }, [router]);

  if (state.kind === "loading") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center bg-white">
        <p className="text-[15px] text-gray-400">불러오는 중…</p>
      </div>
    );
  }

  if (state.kind === "none") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-white px-6">
        <p className="text-center text-[15px] leading-relaxed text-gray-500">
          아직 연결된 선배가 없어요.
          <br />
          매칭 결과에서 선배를 골라주세요.
        </p>
        <Link
          href="/matching/result"
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand text-[16px] font-bold text-white active:bg-brand-dark"
        >
          매칭 결과 보기
        </Link>
      </div>
    );
  }

  const { myName, mentor, contact } = state;
  const persona = PERSONAS[mentor.personaType];
  const [from, to] = persona.gradient;
  const smsHref = `sms:${contact.replace(/-/g, "")}?&body=${encodeURIComponent(
    `안녕하세요! 고3채플에서 매칭된 ${myName}입니다 :)`,
  )}`;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-gray-100 pb-[max(28px,env(safe-area-inset-bottom))]">
      <header className="bg-white px-6 pt-[max(24px,env(safe-area-inset-top))] pb-7">
        <p className="text-[14px] font-medium text-brand">매칭 완료</p>
        <h1 className="mt-2 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          <Name>{mentor.name}</Name> 선배와
          <br />
          연결됐어요
        </h1>

        {/* 선배 요약. 누구인지 확인만 되면 되므로 카드보다 가볍게 둔다. */}
        <div className="mt-5 flex items-center gap-3.5 rounded-2xl bg-gray-50 p-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            aria-hidden
          >
            {nameInitials(mentor.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-gray-900">{mentor.name}</span>
            <span className="mt-0.5 block text-[13px] text-gray-500">
              {mentor.currentCampus} · {mentor.currentMajors[0] ?? persona.name + "형"}
            </span>
          </span>
        </div>

        {/*
          이 화면에서 해야 할 단 하나의 일. 선배에게는 알림이 가지 않으므로
          후배가 먼저 보내지 않으면 아무 일도 일어나지 않는다.
        */}
        <a
          href={smsHref}
          className="mt-6 flex h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[18px] font-bold text-white active:bg-brand-dark"
        >
          문자로 먼저 인사하기
          <span className="text-[20px]" aria-hidden>
            →
          </span>
        </a>

        <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3.5 text-[14px] leading-relaxed text-amber-900">
          <strong className="block font-bold">선배님은 아직 모르고 계세요.</strong>
          매칭 알림이 따로 가지 않아서, 후배가 먼저 인사를 건네야 연결이 시작돼요.
          첫 인사말은 미리 적어뒀으니 그대로 보내도 괜찮아요.
        </p>

        <div className="mt-4 flex items-center justify-center gap-5 text-[14px] font-semibold text-gray-500">
          <span className="font-mono tracking-wide text-gray-700">{contact}</span>
          <a href={`tel:${contact.replace(/-/g, "")}`} className="active:text-gray-900">
            전화 걸기
          </a>
        </div>
      </header>

      {/* 위 버튼이 곧 1단계다. 같은 것을 가리키도록 "지금 할 일"로 묶는다. */}
      <div className="mt-3 bg-white py-7">
        <MentoringGuide activeStep={0} title="이렇게 이어가요" />
      </div>
    </div>
  );
}
