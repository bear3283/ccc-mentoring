"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const notConfigured = params.get("reason") === "not-configured";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;

    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // replace 로 보내야 뒤로가기로 로그인 화면에 다시 걸리지 않는다.
        router.replace(params.get("next") ?? "/admin");
        router.refresh();
        return;
      }

      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "로그인하지 못했어요.");
    } catch {
      setError("연결에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center bg-white px-6">
      <header className="pb-6">
        <p className="text-[14px] font-medium text-brand">운영자 전용</p>
        <h1 className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          비밀번호를 입력해주세요
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          신청자 개인정보가 있는 화면이에요.
        </p>
      </header>

      {notConfigured ? (
        <div className="rounded-2xl bg-red-500/10 px-4 py-4">
          <p className="text-[14px] font-semibold text-red-500">
            운영자 비밀번호가 설정되지 않았어요
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">
            <code className="rounded bg-gray-100 px-1">.env.local</code> 에{" "}
            <code className="rounded bg-gray-100 px-1">ADMIN_PASSWORD</code> 와{" "}
            <code className="rounded bg-gray-100 px-1">ADMIN_SESSION_SECRET</code> 을
            채운 뒤 서버를 다시 시작하세요.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
            placeholder="비밀번호"
            autoComplete="current-password"
            autoFocus
            className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
          />

          {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={!password || busy}
            className="mt-4 h-[54px] w-full rounded-2xl bg-brand text-[17px] font-bold text-white disabled:bg-gray-100 disabled:text-gray-300"
          >
            {busy ? "확인 중…" : "들어가기"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AdminLoginPage() {
  // useSearchParams 는 Suspense 경계 안에서만 정적 렌더링이 가능하다.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
