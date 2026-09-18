"use client";

import { useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { VENUE } from "@/shared/constants/venue";

/**
 * 행사 장소까지 오는 약도.
 *
 * 실제 골목 형태를 그리지 않고 경로 다이어그램으로 만든다.
 * 거리 지형을 정확히 알 수 없는 상태에서 지도를 흉내 내면
 * 당일에 오히려 엉뚱한 길로 보내게 된다.
 * 정확한 길찾기는 네이버 지도로 넘기고, 여기서는 '어느 역 몇 번 출구에서
 * 얼마나 걷는가'만 한눈에 보이게 한다.
 */
export function VenueMap() {
  const routeRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const nodes = routeRef.current?.querySelectorAll("[data-route-node]");
    if (!nodes?.length) return;

    animate(nodes, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 520,
      delay: stagger(110),
      ease: "outExpo",
    });
  }, []);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(`${VENUE.name} ${VENUE.address}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드는 HTTPS에서만 동작한다. 실패해도 주소는 화면에 보이므로 조용히 넘긴다.
    }
  };

  const { station, lines, exit, walkMinutes } = VENUE.primaryRoute;

  return (
    <section className="px-5">
      {/* ── 경로 다이어그램 ── */}
      <div
        ref={routeRef}
        className="rounded-3xl bg-gradient-to-b from-brand-soft to-white p-6"
      >
        <p className="text-[13px] font-semibold text-brand">가장 빠른 길</p>

        <div className="mt-4 flex flex-col">
          {/* 1. 역 */}
          <div data-route-node className="flex items-start gap-3 opacity-0">
            <RouteDot label="1" />
            <div className="pb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[17px] font-bold text-gray-900">{station}</span>
                {lines.map((line) => (
                  <span
                    key={line}
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200"
                  >
                    {line}
                  </span>
                ))}
              </div>
              <p className="mt-0.5 text-[13px] text-gray-500">여기서 내려요</p>
            </div>
          </div>

          <RouteLine />

          {/* 2. 출구 */}
          <div data-route-node className="flex items-start gap-3 opacity-0">
            <RouteDot label="2" />
            <div className="pb-1">
              <p className="text-[17px] font-bold text-gray-900">{exit}</p>
              <p className="mt-0.5 text-[13px] text-gray-500">
                5호선으로 오면 1호선 출구 쪽으로 건너가세요
              </p>
            </div>
          </div>

          <RouteLine walk={walkMinutes} />

          {/* 3. 도착 */}
          <div data-route-node className="flex items-start gap-3 opacity-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[14px]">
              ⛪
            </div>
            <div>
              <p className="text-[17px] font-bold text-brand">{VENUE.name}</p>
              <p className="mt-0.5 text-[13px] text-gray-500">도착!</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 주소 ── */}
      <button
        type="button"
        onClick={copyAddress}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-gray-50 px-4 py-3.5 text-left transition-colors active:bg-gray-100"
      >
        <span className="min-w-0">
          <span className="block text-[12px] text-gray-500">주소</span>
          <span className="mt-0.5 block text-[15px] font-medium text-gray-900">
            {VENUE.address}
          </span>
        </span>
        <span
          className={`ml-3 shrink-0 text-[13px] font-semibold ${
            copied ? "text-green-500" : "text-brand"
          }`}
        >
          {copied ? "복사됨" : "복사"}
        </span>
      </button>

      {/* ── 바로가기 ── */}
      <div className="mt-3">
        <a
          href={VENUE.naverMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand text-[15px] font-bold text-white transition-colors active:bg-brand-dark"
        >
          지도로 길찾기
        </a>
      </div>

      {/* ── 다른 교통편 ── */}
      <details className="mt-4 rounded-2xl bg-gray-50 px-4 py-3.5">
        <summary className="cursor-pointer list-none text-[15px] font-semibold text-gray-800">
          다른 교통편도 볼게요
          <span className="ml-1 text-[13px] font-normal text-gray-400">
            지하철 · 버스
          </span>
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <TransitGroup title="지하철" routes={VENUE.subway} />
          <TransitGroup
            title={`버스 — ${VENUE.busStop} 하차`}
            routes={VENUE.bus}
          />
        </div>
      </details>
    </section>
  );
}

/** 경로 단계 번호. */
function RouteDot({ label }: { label: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-brand ring-1 ring-brand/20">
      {label}
    </span>
  );
}

/**
 * 단계 사이를 잇는 선.
 * 걷는 구간에는 몇 분인지 함께 띄운다.
 */
function RouteLine({ walk }: { walk?: number }) {
  return (
    <div className="flex items-center gap-3 pl-3">
      <span className="h-8 w-px bg-brand/25" />
      {walk !== undefined && (
        <span className="text-[13px] font-medium text-gray-500">
          🚶 걸어서 {walk}분
        </span>
      )}
    </div>
  );
}

function TransitGroup({
  title,
  routes,
}: {
  title: string;
  routes: readonly { line: string; color: string; detail: string }[];
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-gray-500">{title}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {routes.map((route, i) => (
          <li key={`${route.line}-${i}`} className="flex items-start gap-2">
            <span
              className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
              style={{ backgroundColor: route.color }}
            >
              {route.line}
            </span>
            <span className="text-[14px] leading-relaxed text-gray-700">
              {route.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
