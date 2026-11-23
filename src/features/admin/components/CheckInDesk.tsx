"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import type { CheckInPerson } from "@/features/signup/lib/repository";
import { admissionYearLabel, GENDER_LABEL } from "@/shared/constants/domain";
import { cn } from "@/shared/lib/cn";

type Counts = Record<"MENTEE" | "MENTOR", { total: number; attended: number }>;

interface CheckInDeskProps {
  /** 보기 전용 계정. 서버가 출석 기록을 막으므로 화면에서도 버튼을 감춘다. */
  readOnly: boolean;
  /** 조회에 실패하면 null. 숫자 없이도 체크는 할 수 있다. */
  initialCounts: Counts | null;
}

/** 참가자 화면과 같은 말을 쓴다. 입구에서 가장 먼저 가려야 하는 구분이다. */
const ROLE_LABEL = { MENTEE: "고3·예비 27학번", MENTOR: "대학생" } as const;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * 입구 출석 체크 화면.
 *
 * 줄이 서 있는 자리에서 쓰므로 한 사람을 처리하는 동작을 줄인다:
 * 코드나 이름을 치면 바로 찾고, 출석을 누르면 칸을 비워 다음 사람을 받는다.
 */
export function CheckInDesk({ readOnly, initialCounts }: CheckInDeskProps) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<CheckInPerson[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [counts, setCounts] = useState(initialCounts);
  const [busyId, setBusyId] = useState<string>();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  // 늦게 도착한 이전 검색 결과가 최신 결과를 덮지 않게 한다.
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setPeople([]);
      setTruncated(false);
      setStatus("idle");
      return;
    }
    const ticket = ++latest.current;
    setStatus("searching");
    // 한 글자씩 칠 때마다 보내지 않는다.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/checkin?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { people?: CheckInPerson[]; truncated?: boolean; error?: string };
        if (ticket !== latest.current) return;
        if (!res.ok || !body.people) {
          setStatus("error");
          setError(body.error ?? "찾지 못했어요.");
          return;
        }
        setPeople(body.people);
        setTruncated(!!body.truncated);
        setStatus("done");
      } catch {
        if (ticket !== latest.current) return;
        setStatus("error");
        setError("연결에 실패했어요. 인터넷 상태를 확인해주세요.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const mark = async (person: CheckInPerson, undo: boolean) => {
    if (busyId) return;
    setBusyId(person.id);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id, undo }),
      });
      const body = (await res.json()) as { attendedAt?: string | null; error?: string };
      if (!res.ok) {
        setError(body.error ?? "기록하지 못했어요. 다시 눌러주세요.");
        return;
      }
      const attendedAt = body.attendedAt ?? undefined;
      const wasAttended = !!person.attendedAt;
      const nowAttended = !!attendedAt;
      if (counts && wasAttended !== nowAttended) {
        const c = counts[person.role as "MENTEE" | "MENTOR"];
        setCounts({
          ...counts,
          [person.role]: { ...c, attended: c.attended + (nowAttended ? 1 : -1) },
        });
      }

      if (undo) {
        setPeople((list) => list.map((p) => (p.id === person.id ? { ...p, attendedAt } : p)));
        setToast(`${person.name} 출석을 취소했어요`);
        return;
      }
      // 다른 운영자가 먼저 찍었으면 처음 시각이 돌아온다. 그대로 알려준다.
      setToast(
        wasAttended
          ? `${person.name}님은 이미 출석했어요`
          : `${person.name} · ${ROLE_LABEL[person.role as "MENTEE" | "MENTOR"]} 출석 완료`,
      );
      // 다음 사람을 바로 받는다.
      setQuery("");
      inputRef.current?.focus();
    } catch {
      setError("연결에 실패했어요. 인터넷 상태를 확인해주세요.");
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-white px-4 pb-24">
      <header className="sticky top-0 z-10 bg-white pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-brand">{readOnly ? "보기 전용" : "운영자"}</p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-gray-900">출석 체크</h1>
          </div>
          <Link href="/admin" className="text-[13px] font-semibold text-gray-500 underline">
            운영자 화면
          </Link>
        </div>

        {counts && (
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <CountTile
              label="전체"
              attended={counts.MENTEE.attended + counts.MENTOR.attended}
              total={counts.MENTEE.total + counts.MENTOR.total}
            />
            <CountTile label="고3" attended={counts.MENTEE.attended} total={counts.MENTEE.total} />
            <CountTile label="대학생" attended={counts.MENTOR.attended} total={counts.MENTOR.total} />
          </dl>
        )}

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="참여코드 6자리 또는 이름"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="mt-3 h-[56px] w-full rounded-2xl bg-gray-50 px-4 text-[18px] font-semibold text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
        />
        {readOnly && (
          <p className="mt-2 text-[13px] text-gray-500">보기 전용 계정은 찾기만 할 수 있어요. 출석은 운영자 계정으로 찍어주세요.</p>
        )}
      </header>

      {error && (
        <p className="mb-3 rounded-2xl bg-red-500/10 px-4 py-3 text-[14px] font-semibold text-red-500">{error}</p>
      )}

      {status === "searching" && people.length === 0 && (
        <p className="py-6 text-center text-[14px] text-gray-400">찾는 중…</p>
      )}

      {status === "done" && people.length === 0 && (
        <div className="rounded-2xl bg-gray-50 px-4 py-5 text-center">
          <p className="text-[15px] font-bold text-gray-900">등록된 사람이 없어요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
            코드나 이름을 다시 확인해주세요. 등록하지 않은 분은 현장 등록으로 안내해주세요.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            readOnly={readOnly}
            busy={busyId === p.id}
            onCheckIn={() => void mark(p, false)}
            onUndo={() => void mark(p, true)}
          />
        ))}
      </ul>

      {truncated && (
        <p className="mt-3 text-center text-[13px] text-gray-500">
          20명까지만 보여요. 이름을 더 길게 쳐 주세요.
        </p>
      )}

      <Toast message={toast} />
    </div>
  );
}

function CountTile({ label, attended, total }: { label: string; attended: number; total: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <dt className="text-[12px] font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-[16px] font-bold text-gray-900 tabular-nums">
        {attended}
        <span className="text-[13px] font-medium text-gray-400"> / {total}</span>
      </dd>
    </div>
  );
}

function PersonCard({
  person,
  readOnly,
  busy,
  onCheckIn,
  onUndo,
}: {
  person: CheckInPerson;
  readOnly: boolean;
  busy: boolean;
  onCheckIn: () => void;
  onUndo: () => void;
}) {
  const isMentor = person.role === "MENTOR";
  const detail = [
    person.gender ? GENDER_LABEL[person.gender] : undefined,
    isMentor
      ? [person.school, person.admissionYear ? admissionYearLabel(person.admissionYear) : undefined]
          .filter(Boolean)
          .join(" ")
      : person.school,
    person.contactTail ? `☎ ···${person.contactTail}` : undefined,
  ].filter(Boolean);

  return (
    <li
      className={cn(
        "rounded-2xl border px-4 py-3.5",
        person.attendedAt ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* 입구에서 가장 먼저 갈라야 하는 것이라 이름보다 위에 크게 둔다. */}
          <span
            className={cn(
              "inline-block rounded-md px-2 py-0.5 text-[13px] font-bold",
              isMentor ? "bg-gray-900 text-white" : "bg-brand text-white",
            )}
          >
            {ROLE_LABEL[person.role as "MENTEE" | "MENTOR"]}
          </span>
          <p className="mt-1.5 text-[20px] font-bold text-gray-900">
            {person.name}
            <span className="ml-2 font-mono text-[14px] font-semibold tracking-wider text-gray-400">
              {person.code}
            </span>
          </p>
          {detail.length > 0 && <p className="mt-0.5 text-[13px] text-gray-500">{detail.join(" · ")}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {person.isNewFriend && (
              <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-[12px] font-semibold text-green-700">
                🌱 새친구
              </span>
            )}
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[12px] font-semibold text-gray-600">
              {person.mentoringApplied ? (isMentor ? "멘토 신청" : "멘티 신청") : "등록만"}
            </span>
          </div>
        </div>

        {!readOnly && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {person.attendedAt ? (
              <>
                <span className="flex h-[48px] items-center rounded-xl px-3 text-[15px] font-bold text-green-700">
                  ✓ {timeLabel(person.attendedAt)} 출석
                </span>
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={busy}
                  className="h-9 px-2 text-[12px] font-semibold text-gray-400 underline disabled:opacity-50"
                >
                  잘못 눌렀어요
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onCheckIn}
                disabled={busy}
                className="h-[48px] rounded-xl bg-brand px-5 text-[16px] font-bold text-white active:bg-brand-dark disabled:bg-gray-200"
              >
                {busy ? "…" : "출석"}
              </button>
            )}
          </div>
        )}
        {readOnly && person.attendedAt && (
          <span className="shrink-0 text-[14px] font-bold text-green-700">✓ {timeLabel(person.attendedAt)}</span>
        )}
      </div>
    </li>
  );
}
