"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Name } from "@/components/ui/Name";
import { loadDraft } from "@/features/onboarding/lib/draftStore";
import { normalizeParticipationCode } from "@/features/onboarding/lib/participationCode";
import {
  EVENT_ARRIVAL_LABEL,
  EVENT_DATE_LABEL,
  isAfterEvent,
  VENUE,
  type EventArrival,
} from "@/shared/constants/venue";

interface LinkedMentee {
  name: string;
  contact: string;
  campus?: string;
  /** 채플 당일 도착 시간. 그날 언제 찾아가 인사할지 정하는 데 쓴다. */
  eventArrival?: EventArrival;
}

interface MentorMatch {
  mentorName: string;
  /** 신청할 때 고른 정원 */
  capacity: number;
  /** 이 선배를 고른 후배. 먼저 고른 순서. */
  mentees: LinkedMentee[];
}

/**
 * 멘토가 자기 후배를 확인하는 화면.
 *
 * 멘티는 매칭하는 순간 선배 연락처를 보지만, 멘토에게는 확인할 방법이 없었다.
 * 후배가 먼저 문자를 보내면 발신번호로 이름과 번호가 함께 도착하지만,
 * 후배가 망설이는 동안 멘토는 매칭된 사실조차 모른다. 그 사이의 공백을
 * 메우는 화면이다. 정원이 2명 이상이면 연결된 후배가 차례로 쌓인다.
 */
export default function MentorMatchPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<MentorMatch | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  // 방금 신청을 마친 멘토는 코드를 다시 적을 필요가 없다.
  useEffect(() => {
    const stored = loadDraft();
    if (stored?.role === "MENTOR") setCode(stored.participationCode);
  }, []);

  const normalized = normalizeParticipationCode(code);
  const canSubmit = normalized.length === 6 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(undefined);
    setResult(null);
    try {
      const res = await fetch("/api/mentor/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participationCode: normalized }),
      });
      const body = (await res.json()) as MentorMatch & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "확인하지 못했어요.");
        return;
      }
      setResult(body);
    } catch {
      setError("연결에 실패했어요. 인터넷 상태를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const mentees = result?.mentees ?? [];
  const openSeats = result ? Math.max(result.capacity - mentees.length, 0) : 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-6">
      <header className="pt-16 pb-6">
        <p className="text-[14px] font-medium text-brand">멘토</p>
        <h1 className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          어떤 후배와
          <br />
          연결됐는지 볼까요?
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          신청할 때 받은 참여코드를 넣어주세요.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-[15px] font-bold text-gray-900">참여코드</h2>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="6자리"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={10}
          className="w-full rounded-2xl bg-gray-50 px-4 py-3.5 font-mono text-[18px] tracking-[0.2em] text-gray-900 placeholder:font-sans placeholder:text-[15px] placeholder:tracking-normal placeholder:text-gray-400 focus:outline-none"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-3 h-[52px] w-full rounded-2xl bg-brand text-[16px] font-bold text-white active:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-300"
        >
          {loading ? "확인 중…" : "확인하기"}
        </button>

        {error && (
          <p className="mt-3 rounded-2xl bg-red-500/10 px-4 py-3 text-[14px] leading-relaxed text-red-600">
            {error}
          </p>
        )}
      </section>

      {result && (
        <section className="mt-7 flex flex-col gap-3">
          {mentees.length > 0 && (
            <p className="text-[13px] font-semibold text-gray-500">
              <Name>{result.mentorName}</Name>님과 연결된 후배 {mentees.length}명 · 정원{" "}
              {result.capacity}명
            </p>
          )}

          {mentees.map((mentee) => (
            <MenteeCard
              key={mentee.contact}
              mentee={mentee}
              mentorName={result.mentorName}
            />
          ))}

          {/* 자리가 남았다는 것도 알려야 한다. 그래야 더 기다릴지 판단한다. */}
          {openSeats > 0 && (
            <div className="rounded-3xl bg-gray-50 px-6 py-8 text-center">
              <p className="text-[16px] font-bold text-gray-900">
                {mentees.length === 0 ? (
                  <>
                    <Name>{result.mentorName}</Name>님, 아직 연결된 후배가 없어요
                  </>
                ) : (
                  `${openSeats}자리가 더 남아 있어요`
                )}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
                후배가 선배를 고르면 여기에 이름과 연락처가 나와요.
                <br />
                조금만 기다려주세요.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="mt-auto pt-8 pb-[max(24px,env(safe-area-inset-bottom))]">
        <p className="text-center text-[13px] text-gray-400">
          코드를 잊으셨나요?{" "}
          <Link href="/lookup" className="font-semibold text-brand">
            이름과 연락처로 조회
          </Link>
        </p>
      </div>
    </div>
  );
}

function MenteeCard({ mentee, mentorName }: { mentee: LinkedMentee; mentorName: string }) {
  return (
    <div className="rounded-3xl bg-brand p-6 text-white">
      <h2 className="text-[24px] font-bold tracking-[-0.02em]">{mentee.name}</h2>
      {mentee.campus && (
        <p className="mt-1 text-[14px] text-white/85">{mentee.campus} 지망</p>
      )}

      {/* 채플 날은 인사하는 자리다. 1:1 멘토링 날짜는 그 뒤에 문자로 따로 정한다. */}
      {!isAfterEvent() && (
        <p className="mt-3 text-[14px] text-white/85">
          채플 날{" "}
          <b className="font-bold text-white">
            {mentee.eventArrival ? EVENT_ARRIVAL_LABEL[mentee.eventArrival] : "도착 시간 미정"}
          </b>
        </p>
      )}

      <p className="mt-5 font-mono text-[20px] font-bold tracking-wide">{mentee.contact}</p>

      {/* 후배가 먼저 연락하기 어려워할 수 있다. 선배가 먼저 여는 길을 준다. */}
      <a
        href={`sms:${mentee.contact.replace(/-/g, "")}?&body=${encodeURIComponent(
          `안녕하세요! 고3채플에서 ${mentee.name}님과 매칭된 ${mentorName}입니다 :)`,
        )}`}
        className="mt-4 flex h-[52px] w-full items-center justify-center gap-1.5 rounded-2xl bg-white text-[16px] font-bold text-brand active:bg-white/85"
      >
        먼저 문자 보내기
        <span className="text-[17px]" aria-hidden>
          →
        </span>
      </a>
      <p className="mt-2.5 text-center text-[13px] text-white/70">
        {isAfterEvent()
          ? "1:1 멘토링 날을 정해 만나보세요."
          : `${EVENT_DATE_LABEL} ${VENUE.name}에서 인사하고, 1:1 멘토링은 그 뒤에 따로 잡아요.`}
      </p>
    </div>
  );
}
