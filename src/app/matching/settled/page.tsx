"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Name } from "@/components/ui/Name";
import type { PublicMatchResult } from "@/features/matching/model/types";
import { loadDraft } from "@/features/onboarding/lib/draftStore";
import { MentoringGuide } from "@/features/venue/components/MentoringGuide";
import { NO_PERSONA_GRADIENT, PERSONAS } from "@/shared/constants/persona";
import {
  EVENT_ARRIVAL_LABEL,
  EVENT_DATE_LABEL,
  isAfterEvent,
  type EventArrival,
} from "@/shared/constants/venue";
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
      /** 채플 당일 도착 시간. 선배 것은 연결된 뒤에만 서버가 알려준다. */
      mentorArrival?: EventArrival;
      myArrival?: EventArrival;
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
        mentee?: { eventArrival?: EventArrival };
      };
      // 서버 값이 우선이다. 다른 기기에서 코드로 들어오면 브라우저 초안이 비어 있다.
      const myArrival = matchBody.mentee?.eventArrival ?? stored.draft.eventArrival;

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
      const revealBody = (await revealRes.json()) as {
        contact?: string;
        mentorEventArrival?: EventArrival;
      };
      if (!revealRes.ok || !revealBody.contact) {
        setState({ kind: "none" });
        return;
      }

      setState({
        kind: "ready",
        myName,
        mentor,
        contact: revealBody.contact,
        mentorArrival: revealBody.mentorEventArrival,
        myArrival,
      });
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

  const { myName, mentor, contact, mentorArrival, myArrival } = state;
  const beforeEvent = !isAfterEvent();
  // 채플 전이고 오는 시간을 골랐으면 첫 문자에 "그날 인사" 약속까지 넣는다.
  // 채플이 지났거나 당일에 못 오면 인사 약속 문장은 뺀다.
  const canGreet = beforeEvent && !!myArrival && myArrival !== "ABSENT";
  const introLine = `안녕하세요! 고3채플에서 매칭된 ${myName}입니다 :)`;
  const greetLine = canGreet
    ? `채플 날 저는 ${arrivalPhrase(myArrival as Exclude<EventArrival, "ABSENT">)} 도착해요. 그날 잠깐 인사드려도 될까요?`
    : undefined;
  const persona = mentor.personaType ? PERSONAS[mentor.personaType] : undefined;
  const [from, to] = persona?.gradient ?? NO_PERSONA_GRADIENT;
  const smsHref = `sms:${contact.replace(/-/g, "")}?&body=${encodeURIComponent(
    greetLine ? `${introLine}\n${greetLine}` : introLine,
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
              {mentor.currentCampus} · {mentor.currentMajors[0] ?? (persona ? `${persona.name}형` : "")}
            </span>
          </span>
        </div>

        {/*
          이 화면에서 해야 할 단 하나의 일. 선배에게는 자동 알림이 없고 운영진이
          문자로 알리는데(운영자 화면 "선배 알림"), 그때까지 시간이 걸린다.
          후배가 먼저 보내면 그 공백 없이 바로 이어진다.
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
          <strong className="block font-bold">선배님은 아직 모르고 계실 수 있어요.</strong>
          운영진이 선배님께 문자로 알려드리지만 시간이 걸려요. 먼저 인사를 건네면
          바로 이어져요. 첫 인사말은 미리 적어뒀으니 그대로 보내도 괜찮아요.
        </p>

        <div className="mt-4 flex items-center justify-center gap-5 text-[14px] font-semibold text-gray-500">
          <span className="font-mono tracking-wide text-gray-700">{contact}</span>
          <a href={`tel:${contact.replace(/-/g, "")}`} className="active:text-gray-900">
            전화 걸기
          </a>
        </div>
      </header>

      {/*
        채플 날은 인사만 하는 자리다. 서로 언제 오는지 알아야 그날 찾아갈 수 있다.
        1:1 멘토링 날짜는 그 뒤에 따로 정한다(아래 안내 3단계).
      */}
      {beforeEvent && (
        <section className="mt-3 bg-white px-6 py-7">
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-gray-900">
            {EVENT_DATE_LABEL} 채플에서 인사해요
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">
            1:1 멘토링은 채플 뒤에 따로 날을 잡아요. 채플 날에는 얼굴 보고 인사만 해요.
          </p>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-[15px]">
            <dt className="font-semibold text-gray-500">선배</dt>
            <dd className="font-bold text-gray-900">
              {mentorArrival ? EVENT_ARRIVAL_LABEL[mentorArrival] : "아직 몰라요"}
            </dd>
            <dt className="font-semibold text-gray-500">나</dt>
            <dd className="font-bold text-gray-900">
              {myArrival ? EVENT_ARRIVAL_LABEL[myArrival] : "고르지 않았어요"}
            </dd>
          </dl>
          {(mentorArrival === "ABSENT" || myArrival === "ABSENT") && (
            <p className="mt-4 rounded-2xl bg-gray-50 px-4 py-3.5 text-[13px] leading-relaxed text-gray-600">
              채플 날 만나기 어렵다면, 문자로 1:1 멘토링 날을 바로 정해 보세요.
            </p>
          )}
          {!mentorArrival && (
            <p className="mt-4 rounded-2xl bg-gray-50 px-4 py-3.5 text-[13px] leading-relaxed text-gray-600">
              선배가 언제 오는지는 첫 문자에서 물어보면 돼요.
            </p>
          )}
        </section>
      )}

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

        {/*
          1·2번은 [문자로 먼저 인사하기]를 누르면 이미 채워져 있다.
          채플 뒤 만날 약속(마지막 줄)은 채우지 않는다. 첫 문자에 약속까지 넣으면 부담스럽고,
          채플 날 얼굴을 본 뒤에 잡는 편이 자연스럽다.
        */}
        <ol className="mt-5 flex flex-col gap-4">
          <GuideLine
            step="1"
            title="누구인지 밝히기"
            body={introLine}
            note={greetLine ? "버튼을 누르면 1·2번 문장이 이미 채워져 있어요." : "버튼을 누르면 이 문장은 이미 채워져 있어요."}
          />
          {greetLine && (
            <GuideLine
              step="2"
              title="채플 날 인사 약속"
              body={greetLine}
              note="고른 도착 시간이 들어가 있어요. 선배님이 언제 오는지도 물어보면 좋아요."
            />
          )}
          <GuideLine
            step={greetLine ? "3" : "2"}
            title="채플 날 이후의 만날 약속을 잡아보아요"
            body="채플 끝나고 한 번 더 뵙고 싶은데, 선배님은 언제가 괜찮으세요?"
            note={
              greetLine
                ? "이 문장은 미리 적어두지 않았어요. 채플 날 인사한 뒤에 보내도 좋아요."
                : "이 문장은 미리 적어두지 않았어요. 첫 인사에 답이 오면 이어서 보내보세요."
            }
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

/** "오후 6시 ~ 6시 30분 사이에" / "오후 7시 이후에". 첫 문자 예시에 그대로 넣는다. */
function arrivalPhrase(arrival: Exclude<EventArrival, "ABSENT">): string {
  // 선택지 이름의 "(채플 시작 후)"는 문자 문장에 넣으면 어색해 뺀다.
  if (arrival === "1900_LATER") return "오후 7시 이후에";
  return `${EVENT_ARRIVAL_LABEL[arrival]} 사이에`;
}
