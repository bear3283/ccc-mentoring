"use client";

import { useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { VENUE } from "@/shared/constants/venue";
import { VenueIllustration } from "./VenueIllustration";

/**
 * 행사 장소까지 오는 약도.
 *
 * 위에 일러스트 약도(실제 길 좌표로 그렸다), 아래에 같은 번호의 글 안내를 둔다.
 * 그림만으로는 "어디서 꺾는지"를 놓치기 쉬워 꺾는 곳의 표지(대윤병원 정류장)를
 * 글로 한 번 더 짚는다. 정확한 길찾기는 네이버 지도로 넘긴다.
 */
export function VenueMap() {
  const routeRef = useRef<HTMLOListElement>(null);
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
      {/* ── 일러스트 약도 ── 번호는 아래 안내와 같다. */}
      <VenueIllustration />

      <ol ref={routeRef} className="mt-4 flex flex-col gap-3">
        <RouteStep n={1} title={`${station} ${exit}로 나와요`}>
          {lines.join("·")} 어느 쪽에서 내려도 {exit} 표지판을 따라 나오면 돼요.
        </RouteStep>
        <RouteStep n={2} title="영등포로를 따라 쭉 내려와요">
          약 250m. 대윤병원 버스정류장이 보이면 그 앞 왼쪽 골목으로 들어가요.
        </RouteStep>
        <RouteStep n={3} title={`골목 안쪽에 ${VENUE.name}`}>
          골목을 따라 150m쯤 가면 왼쪽에 있어요. 걸어서 약 {walkMinutes}분.
        </RouteStep>
      </ol>

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

/** 글 안내 한 단계. 번호는 약도의 배지와 같다. */
function RouteStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li data-route-node className="flex items-start gap-3 opacity-0">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-gray-900">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500">{children}</p>
      </div>
    </li>
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
