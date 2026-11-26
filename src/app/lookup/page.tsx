"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { SeniorPreview } from "@/features/onboarding/components/SeniorPreview";
import { saveDraft } from "@/features/onboarding/lib/draftStore";
import { mentoringInvite } from "@/features/onboarding/lib/mentoringInvite";
import { MENTORING_PATH, safeMentoringNext } from "@/features/onboarding/lib/mentoringPath";
import { EMPTY_DRAFT, type OnboardingDraft } from "@/features/onboarding/model/types";

/** 멘토링 신청 화면이 이어 쓸 등록 정보. 신청하지 않은 사람에게만 온다. */
type Resume = Pick<OnboardingDraft, "gender" | "currentCampus" | "admissionYear">;

type RosterEntry = {
  code: string;
  name: string;
  role: "MENTEE" | "MENTOR";
  mentoringApplied: boolean;
  resume?: Resume;
};

// 등록 화면과 같은 말을 쓴다. "멘티/멘토"는 참가자에게 낯선 프로그램 용어다.
const ROLE_LABEL = { MENTEE: "고3·예비 27학번", MENTOR: "대학생" } as const;

/** 입력하는 대로 하이픈을 넣어준다. 신청할 때와 같은 규칙. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

type Result = { kind: "idle" } | { kind: "found"; entry: RosterEntry } | { kind: "notFound" };

export default function LookupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  /**
   * 멘토링 신청 화면이 등록 정보가 없어 보낸 경우 ?next=신청화면 이 붙어 온다.
   * 찾으면 그 화면으로 바로 돌려보낸다. reason=expired 는 답하는 도중 정보가 사라진 경우.
   * 주소 값은 브라우저에서만 읽는다(이 화면은 정적으로 미리 그려진다).
   */
  const [next, setNext] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  // 첫 화면의 "이미 등록했어요 · 멘토링 신청하기"로 온 사람. 코드가 아니라 신청하러 왔다.
  const [forMentoring, setForMentoring] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeMentoringNext(params.get("next")));
    setExpired(params.get("reason") === "expired");
    setForMentoring(params.get("for") === "mentoring");
  }, []);

  /**
   * 등록만 하고 멘토링은 신청하지 않은 사람. 등록 정보를 이 탭에 남겨 두면 신청 화면이
   * 그 위에 이어 쓴다 — 이름·성별·학교·학번을 다시 묻지 않는다.
   */
  const startMentoring = (entry: RosterEntry) => {
    saveDraft(
      entry.role,
      { ...EMPTY_DRAFT, ...entry.resume, role: entry.role, name: entry.name },
      entry.code,
    );
    router.push(MENTORING_PATH[entry.role]);
  };

  const canSubmit = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;

  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact: phone }),
      });
      const body = (await res.json()) as {
        found?: boolean;
        participationCode?: string;
        name?: string;
        role?: "MENTEE" | "MENTOR";
        mentoringApplied?: boolean;
        resume?: Resume;
        error?: string;
      };

      if (res.ok && body.found && body.participationCode && body.role) {
        const entry: RosterEntry = {
          code: body.participationCode,
          name: body.name ?? name,
          role: body.role,
          mentoringApplied: body.mentoringApplied ?? true,
          resume: body.resume,
        };
        // 신청 화면에서 넘어온 사람이 아직 신청 전이면 묻지 않고 그 화면으로 돌려보낸다.
        // 이미 신청했거나 다른 역할의 화면에서 왔으면 아래 결과 화면에서 맞는 길을 고르게 한다.
        if (next && !entry.mentoringApplied && MENTORING_PATH[entry.role] === next) {
          startMentoring(entry);
          return;
        }
        setResult({ kind: "found", entry });
      } else {
        setResult({ kind: "notFound" });
      }
    } catch {
      setResult({ kind: "notFound" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-6">
      <header className="pt-14 pb-6">
        <p className="text-[14px] font-medium text-brand">
          {forMentoring ? "멘토링 신청" : "참여코드 조회"}
        </p>
        <h1 className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          {forMentoring ? "등록한 정보로 이어서 신청해요" : "코드를 잊으셨나요?"}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          {forMentoring
            ? "채플 등록할 때 적은 이름과 연락처만 넣으면 돼요. 참여코드는 몰라도 괜찮아요."
            : "신청할 때 적은 이름과 연락처로 찾아드려요."}
        </p>
        {next && result.kind !== "found" && (
          <div className="mt-4 rounded-2xl bg-brand-soft px-4 py-3">
            <p className="text-[14px] font-bold text-gray-900">
              {expired ? "등록 정보를 다시 확인할게요" : "멘토링 신청 전에 등록 정보를 확인할게요"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
              {expired
                ? "확인이 끝나면 신청 화면으로 돌아가요. 번거롭지만 답을 한 번 더 골라주세요."
                : "채플 등록할 때 적은 이름과 연락처를 넣으면 신청 화면으로 바로 이어져요."}
            </p>
          </div>
        )}
      </header>

      {result.kind === "found" ? (
        <div>
          <p className="text-[18px] font-bold text-gray-900">
            <Name>{result.entry.name}</Name>님, 찾았어요
          </p>
          <p className="mt-1 text-[14px] font-semibold text-brand">
            {ROLE_LABEL[result.entry.role]}으로 등록하셨어요
          </p>

          {/*
            코드만 돌려주고 끝내면 "그래서 뭘 하지?"가 남는다.
            역할마다 다음에 할 일이 다르므로 그 길을 바로 열어 준다.
            선배에게는 알림이 가지 않아, 직접 확인하러 오는 통로가 특히 필요하다.
          */}
          {!result.entry.mentoringApplied ? (
            /*
             * 등록만 하고 멘토링은 신청하지 않은 사람. 이 사람이 이 화면에서 정할 것은
             * "선배를 만날지"다. 등록 완료 화면과 같은 권유 카드를 주인공으로 두고,
             * 코드는 참고 크기로 아래에 둔다.
             */
            <MentoringInviteCard entry={result.entry} onStart={() => startMentoring(result.entry)} />
          ) : result.entry.role === "MENTOR" ? (
            // 코드를 #뒤에 실어 보내 다음 화면에서 다시 넣지 않게 한다. #뒤는 서버 기록에 남지 않는다.
            <Link
              href={`/mentor/match#${result.entry.code}`}
              className="mt-4 flex h-[54px] w-full items-center justify-center gap-1.5 rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
            >
              매칭 확인하기
              <span className="text-[18px]" aria-hidden>
                →
              </span>
            </Link>
          ) : (
            <Link
              href={`/matching/result#${result.entry.code}`}
              className="mt-4 flex h-[54px] w-full items-center justify-center gap-1.5 rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
            >
              매칭 결과 보기
              <span className="text-[18px]" aria-hidden>
                →
              </span>
            </Link>
          )}

          {/* 코드는 나중에 다시 꺼내 보는 값이라 참고 크기로 둔다. */}
          <div className="mt-6">
            <CodeBadge code={result.entry.code} size="compact" />
          </div>

          <button
            type="button"
            onClick={() => {
              setResult({ kind: "idle" });
              setName("");
              setPhone("");
            }}
            className="mt-3 h-[52px] w-full rounded-2xl bg-gray-100 text-[16px] font-bold text-gray-700"
          >
            다른 사람 조회하기
          </button>
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-[15px] font-bold text-gray-900">이름</h2>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setResult({ kind: "idle" });
              }}
              placeholder="신청할 때 적은 이름"
              autoComplete="name"
              className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
            />
          </section>

          <section className="mt-5">
            <h2 className="mb-2 text-[15px] font-bold text-gray-900">연락처</h2>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value));
                setResult({ kind: "idle" });
              }}
              onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
              placeholder="010-1234-5678"
              autoComplete="tel"
              className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
            />
          </section>

          {result.kind === "notFound" && (
            <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3">
              <p className="text-[14px] font-semibold text-red-500">
                일치하는 신청 내역이 없어요
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
                이름과 연락처가 신청할 때와 같은지 확인해주세요. 그래도 안 되면
                현장 운영자에게 문의해주세요.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || busy}
            className="mt-5 h-[54px] w-full rounded-2xl bg-brand text-[17px] font-bold text-white disabled:bg-gray-100 disabled:text-gray-300"
          >
            {busy ? "찾는 중…" : canSubmit ? "코드 찾기" : "이름과 연락처를 입력해주세요"}
          </button>

          <p className="mt-6 text-center text-[13px] text-gray-400">
            {forMentoring ? "아직 채플 등록 전이신가요?" : "아직 신청 전이신가요?"}{" "}
            <Link href="/" className="font-semibold text-brand">
              {forMentoring ? "등록하기" : "신청하기"}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

/** 멘토링을 아직 신청하지 않은 사람에게 보여 주는 권유 카드. 등록 완료 화면과 같은 모양이다. */
function MentoringInviteCard({ entry, onStart }: { entry: RosterEntry; onStart: () => void }) {
  const invite = mentoringInvite(entry.role);
  const isMentee = entry.role === "MENTEE";

  return (
    <div className="mt-5 rounded-3xl bg-brand p-6 text-white">
      <p className="text-[13px] font-semibold text-white/75">
        {isMentee ? "아직 멘토링 신청 전이에요" : "아직 멘토 신청 전이에요 · 한 영혼 품기 운동"}
      </p>
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

      {isMentee && (
        <div className="mt-5">
          <SeniorPreview gender={entry.resume?.gender} tone="onBrand" />
        </div>
      )}

      <button
        type="button"
        onClick={onStart}
        className="mt-6 flex h-[56px] w-full items-center justify-center gap-1.5 rounded-2xl bg-white text-[17px] font-bold text-brand active:bg-white/85"
      >
        {invite.cta}
        <span className="text-[18px]" aria-hidden>
          →
        </span>
      </button>
      <p className="mt-2.5 text-center text-[13px] text-white/70">{invite.footnote}</p>
    </div>
  );
}
