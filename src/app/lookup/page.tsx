"use client";

import Link from "next/link";
import { useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
type RosterEntry = { code: string; name: string; role: "MENTEE" | "MENTOR" };

const ROLE_LABEL = { MENTEE: "멘티", MENTOR: "멘토" } as const;

/** 입력하는 대로 하이픈을 넣어준다. 신청할 때와 같은 규칙. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

type Result = { kind: "idle" } | { kind: "found"; entry: RosterEntry } | { kind: "notFound" };

export default function LookupPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

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
        error?: string;
      };

      if (res.ok && body.found && body.participationCode && body.role) {
        setResult({
          kind: "found",
          entry: { code: body.participationCode, name: body.name ?? name, role: body.role },
        });
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
        <p className="text-[14px] font-medium text-brand">참여코드 조회</p>
        <h1 className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          코드를 잊으셨나요?
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          신청할 때 적은 이름과 연락처로 찾아드려요.
        </p>
      </header>

      {result.kind === "found" ? (
        <div>
          <p className="text-[18px] font-bold text-gray-900">
            <Name>{result.entry.name}</Name>님, 찾았어요
          </p>
          <p className="mt-1 text-[14px] font-semibold text-brand">
            {ROLE_LABEL[result.entry.role]}로 신청하셨어요
          </p>

          <div className="mt-5">
            <CodeBadge code={result.entry.code} />
          </div>

          <button
            type="button"
            onClick={() => {
              setResult({ kind: "idle" });
              setName("");
              setPhone("");
            }}
            className="mt-4 h-[54px] w-full rounded-2xl bg-gray-100 text-[17px] font-bold text-gray-700"
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
            아직 신청 전이신가요?{" "}
            <Link href="/" className="font-semibold text-brand">
              신청하기
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
