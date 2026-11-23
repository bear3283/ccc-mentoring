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
  /** 이 기기에서 방금 찍은 사람들. 노트북 화면 오른쪽에 쌓아 잘못 찍은 것을 바로 되돌린다. */
  const [recent, setRecent] = useState<CheckInPerson[]>([]);
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
        setRecent((list) => list.filter((p) => p.id !== person.id));
        setToast(`${person.name} 출석을 취소했어요`);
        inputRef.current?.focus();
        return;
      }
      setRecent((list) => [{ ...person, attendedAt }, ...list.filter((p) => p.id !== person.id)].slice(0, 30));
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

  /** 찾은 사람이 한 명이고 아직 안 왔으면 Enter 로 바로 찍는다. 노트북에서 마우스 없이 받는다. */
  const single = status === "done" && people.length === 1 ? people[0] : undefined;
  const enterReady = !readOnly && !!single && !single.attendedAt;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setError(undefined);
      return;
    }
    // 한글 입력을 조합하는 중의 Enter 는 글자 확정이다. 출석으로 받으면 안 된다.
    if (e.key === "Enter" && !e.nativeEvent.isComposing && enterReady && single) {
      e.preventDefault();
      void mark(single, false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-white px-4 pb-24 lg:max-w-[1180px] lg:px-8 lg:pb-10">
      <header className="sticky top-0 z-10 bg-white pt-5 pb-3 lg:static lg:pt-8 lg:pb-5">
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
          <dl className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
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
          onKeyDown={handleKeyDown}
          className="mt-3 h-[56px] w-full rounded-2xl bg-gray-50 px-4 text-[18px] font-semibold text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft lg:mt-5 lg:h-[68px] lg:px-6 lg:text-[24px]"
        />
        {/* 키보드로 받는 노트북에서만 안내한다. 휴대폰에는 Enter·Esc 가 없다. */}
        <p className="mt-2 hidden text-[13px] text-gray-400 lg:block">
          {enterReady ? (
            <span className="font-semibold text-brand">Enter를 누르면 {single?.name}님 출석</span>
          ) : (
            "코드나 이름을 치면 바로 찾아요 · 한 명만 나오면 Enter로 출석 · Esc로 지우기"
          )}
        </p>
        {readOnly && (
          <p className="mt-2 text-[13px] text-gray-500">보기 전용 계정은 찾기만 할 수 있어요. 출석은 운영자 계정으로 찍어주세요.</p>
        )}
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <section>
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

          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
            {people.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                readOnly={readOnly}
                busy={busyId === p.id}
                enterTarget={enterReady && p.id === single?.id}
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
        </section>

        {/* 노트북: 인원 현황과 방금 찍은 사람. 휴대폰에서는 머리의 숫자만 둔다. */}
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          {counts && (
            <dl className="grid grid-cols-3 gap-2">
              <CountTile
                label="전체"
                attended={counts.MENTEE.attended + counts.MENTOR.attended}
                total={counts.MENTEE.total + counts.MENTOR.total}
              />
              <CountTile label="고3" attended={counts.MENTEE.attended} total={counts.MENTEE.total} />
              <CountTile label="대학생" attended={counts.MENTOR.attended} total={counts.MENTOR.total} />
            </dl>
          )}
          <h2 className="mt-6 text-[14px] font-bold text-gray-900">
            방금 출석 <span className="font-medium text-gray-400">· 이 노트북에서</span>
          </h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-[13px] text-gray-400">아직 없어요.</p>
          ) : (
            <ul className="mt-2 max-h-[calc(100dvh-260px)] divide-y divide-gray-100 overflow-y-auto">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-2">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold text-white",
                      p.role === "MENTOR" ? "bg-gray-900" : "bg-brand",
                    )}
                  >
                    {p.role === "MENTOR" ? "대학생" : "고3"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-gray-900">{p.name}</span>
                  <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">
                    {p.attendedAt ? timeLabel(p.attendedAt) : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => void mark(p, true)}
                    disabled={busyId === p.id}
                    className="shrink-0 text-[12px] font-semibold text-gray-400 underline hover:text-red-500 disabled:opacity-50"
                  >
                    취소
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

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
  enterTarget,
  onCheckIn,
  onUndo,
}: {
  person: CheckInPerson;
  readOnly: boolean;
  busy: boolean;
  /** Enter 를 누르면 찍힐 사람. 노트북에서 누가 찍히는지 테두리로 보여준다. */
  enterTarget: boolean;
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
        enterTarget && "lg:border-brand lg:ring-2 lg:ring-brand/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* 입구에서 가장 먼저 갈라야 하는 것이라 이름보다 위에 크게 둔다. */}
          <span
            className={cn(
              "inline-block rounded-md px-2 py-0.5 text-[13px] font-bold lg:text-[15px]",
              isMentor ? "bg-gray-900 text-white" : "bg-brand text-white",
            )}
          >
            {ROLE_LABEL[person.role as "MENTEE" | "MENTOR"]}
          </span>
          <p className="mt-1.5 text-[20px] font-bold text-gray-900 lg:text-[22px]">
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
                className="h-[48px] rounded-xl bg-brand px-5 text-[16px] font-bold text-white hover:bg-brand-dark active:bg-brand-dark disabled:bg-gray-200"
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
