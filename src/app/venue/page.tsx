"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MeetingSpots } from "@/features/venue/components/MeetingSpots";
import { VenueMap } from "@/features/venue/components/VenueMap";
import { VENUE } from "@/shared/constants/venue";

/**
 * 행사 장소 안내.
 *
 * 매칭 결과와 완료 화면 양쪽에서 들어온다.
 * 참여코드 없이도 볼 수 있어야 한다 — 당일에 길을 찾는 사람은
 * 코드를 꺼내볼 겨를이 없다.
 */
export default function VenuePage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white">
      <header className="sticky top-0 z-10 bg-white/90 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-[20px] text-gray-500 active:bg-gray-100"
          aria-label="뒤로"
        >
          ←
        </button>
      </header>

      <div className="px-5 pb-5">
        <p className="text-[14px] font-medium text-brand">행사 장소</p>
        <h1 className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          {VENUE.name}에서 만나요
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          매칭된 선배·후배와 채팅으로 먼저 인사하고, 행사 당일 여기서 만나
          이야기를 나눠요.
        </p>
      </div>

      <VenueMap />

      <div className="mt-10">
        <MeetingSpots />
      </div>

      <div className="mt-10 px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Link
          href="/"
          className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-gray-100 text-[17px] font-bold text-gray-700 active:bg-gray-200"
        >
          처음으로
        </Link>
      </div>
    </div>
  );
}
