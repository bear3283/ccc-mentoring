"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHECKIN_PAGE, safeAdminPath } from "@/shared/lib/security/adminSession";

interface LoginFormProps {
  /** 로그인 후 돌아갈 곳(주소의 next). */
  next: string | null;
  /** 운영자 비밀번호가 설정되지 않아 미들웨어가 돌려보낸 경우. */
  notConfigured: boolean;
}

/**
 * 운영자·보기 전용·출석 전용 로그인 폼.
 *
 * 주소 값(next, reason)은 서버 페이지가 읽어 넘긴다. 예전에는 여기서 useSearchParams 로
 * 읽었는데, 그러면 폼 전체가 브라우저에서 자바스크립트를 실행한 뒤에야 그려진다.
 * 카카오톡 안 브라우저나 느린 현장 인터넷에서는 그동안 흰 화면만 보여
 * "비밀번호 칸이 안 나온다"는 문제가 됐다.
 */
export function LoginForm({ next, notConfigured }: LoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // 출석 링크로 들어온 봉사자에게는 출석 체크 화면이라고 알려준다.
  const forCheckIn = next === CHECKIN_PAGE;

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
        // 출석 전용 비밀번호로 들어왔으면 갈 곳은 출석 화면뿐이다.
        const { role } = (await res.json()) as { role?: string };
        router.replace(role === "checkin" ? CHECKIN_PAGE : safeAdminPath(next));
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
        <p className="text-[14px] font-medium text-brand">{forCheckIn ? "채플 출석 체크" : "운영자 전용"}</p>
        <h1 className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          비밀번호를 입력해주세요
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          {forCheckIn
            ? "안내받은 출석 체크 비밀번호를 넣어주세요."
            : "신청자 개인정보가 있는 화면이에요."}
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
        // method="post": 자바스크립트가 아직 안 붙은 채 눌러도 비밀번호가 주소에 실리지 않게 한다.
        <form method="post" onSubmit={handleSubmit}>
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
