"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Name } from "@/components/ui/Name";
import type { PublicMatchResult } from "@/features/matching/model/types";
import { AREA_META, type MentoringArea } from "@/shared/constants/domain";
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
  | {
      kind: "ready";
      myName: string;
      mentor: PublicMatchResult["mentor"];
      contact: string;
      /** 내가 고른 관심 영역. 첫 문자에 넣을 질문 예시를 여기서 뽑는다. */
      areas: MentoringArea[];
    };

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
    const areas = stored.draft.desiredAreas ?? [];

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

      setState({ kind: "ready", myName, mentor, contact: revealBody.contact, areas });
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

  const { myName, mentor, contact, areas } = state;
  // 고3이 가장 막히는 지점은 번호가 아니라 "뭐라고 보내지"다.
  // 본인이 고른 관심 영역에서 질문 하나를 꺼내 보여주면 그 자리가 메워진다.
  const sampleAsk = areas[0] ? AREA_META[areas[0]].ask : "대학 생활은 어떠세요?";
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

      {/*
        번호를 받고도 막히는 곳은 "뭐라고 보내지"다. 예시를 보여주면 그 자리가 메워진다.
        길게 쓰라고 하면 오히려 못 보내므로, 짧게 보내도 된다는 것을 먼저 말한다.
      */}
      <section className="mt-3 bg-white px-6 py-7">
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-gray-900">
          뭐라고 보낼까요?
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">
          짧아도 괜찮아요. 세 줄이면 충분해요.
        </p>

        <ol className="mt-5 flex flex-col gap-4">
          <GuideLine
            step="1"
            title="누구인지 밝히기"
            body={`안녕하세요! 고3채플에서 매칭된 ${myName}입니다 :)`}
            note="버튼을 누르면 이 문장은 이미 채워져 있어요."
          />
          <GuideLine
            step="2"
            title="궁금한 걸 하나만"
            body={sampleAsk}
            note={
              areas[0]
                ? `${areas[0]}에 관심 있다고 하셨죠. 이런 식으로 하나만 물어봐도 대화가 열려요.`
                : "한 번에 여러 개를 묻기보다 하나씩 물어보는 편이 답하기 쉬워요."
            }
          />
          <GuideLine
            step="3"
            title="언제 편한지 덧붙이기"
            body="저는 평일 저녁이 편한데, 선배님은 언제가 괜찮으세요?"
            note="답장 부담이 줄어들어요."
          />
        </ol>

        <p className="mt-5 rounded-2xl bg-gray-50 px-4 py-3.5 text-[13px] leading-relaxed text-gray-600">
          <strong className="font-bold text-gray-900">이런 건 안 해도 돼요</strong>
          <br />
          길게 쓰기 · 존댓말 완벽하게 다듬기 · 바로 답장 오기를 기다리기.
          선배님도 처음이라 어색해요.
        </p>
      </section>

      {/* 위 버튼이 곧 1단계다. 같은 것을 가리키도록 "지금 할 일"로 묶는다. */}
      <div className="mt-3 bg-white py-7">
        <MentoringGuide activeStep={0} title="이렇게 이어가요" />
      </div>
    </div>
  );
}

/** 첫 문자에 넣을 한 줄. 예시 문장은 따옴표 대신 말풍선으로 보여 그대로 쓸 수 있게 한다. */
function GuideLine({
  step,
  title,
  body,
  note,
}: {
  step: string;
  title: string;
  body: string;
  note: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-bold text-brand tabular-nums">
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-gray-900">{title}</p>
        <p className="mt-1.5 rounded-xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-[14px] leading-relaxed text-gray-800">
          {body}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">{note}</p>
      </div>
    </li>
  );
}
