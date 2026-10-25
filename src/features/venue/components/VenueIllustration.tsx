import { VENUE_MAP } from "../lib/venueMapGeometry.generated";

/**
 * 신길역 1번 출구 → 신길교회 일러스트 약도.
 *
 * 길 모양은 OpenStreetMap 좌표를 그대로 쓴다(scripts/build-venue-map.py).
 * 그림체만 단순하게 바꿨을 뿐 골목의 방향과 길이는 실제와 같다. 손으로 그린
 * 약도는 보기 좋아도 당일에 엉뚱한 골목으로 보낼 수 있다.
 *
 * 숫자 배지(1·2·3)는 아래 글 안내의 단계와 같은 번호다.
 */

const BRAND = "#bf4e2b";
/** 서울 지하철 노선 색. */
const LINE1 = "#0052A4";
const LINE5 = "#996CAC";
const { width: W, height: H, points: p } = VENUE_MAP;

/** 100m 가 화면에서 몇 칸인지. 거리 감각을 주는 축척 막대에 쓴다. */
const HUNDRED_METERS = 100 / VENUE_MAP.metersPerPx;

export function VenueIllustration() {
  return (
    <figure className="overflow-hidden rounded-3xl bg-[#fbf3ec] ring-1 ring-brand/10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`신길역 1번 출구에서 영등포로를 따라 내려가다 대윤병원 버스정류장 앞에서 왼쪽 골목으로 들어가면 신길교회가 나와요. 걸어서 약 ${VENUE_MAP.walkMeters}미터.`}
      >
        {/* ── 길 ── 테두리 위에 흰 길을 얹어 일러스트처럼 보이게 한다. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={VENUE_MAP.minor} stroke="#ead9cb" strokeWidth={9} />
          <path d={VENUE_MAP.minor} stroke="#fffaf6" strokeWidth={6} />
          <path d={VENUE_MAP.main} stroke="#e3cdbb" strokeWidth={19} />
          <path d={VENUE_MAP.main} stroke="#ffffff" strokeWidth={15} />
        </g>

        {/* ── 전철 노선 ── 선로 대신 노선 색 선 하나로만. 5호선은 땅속이라 점선으로. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.75}>
          <path d={VENUE_MAP.line1} stroke={LINE1} strokeWidth={4} />
          <path d={VENUE_MAP.line5} stroke={LINE5} strokeWidth={4} strokeDasharray="7 5" />
        </g>

        {/* ── 걷는 길 ── 둥근 점선이라 "걸어가는 길"로 읽힌다. */}
        <path
          d={VENUE_MAP.walk}
          fill="none"
          stroke={BRAND}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.1 9"
        />

        {/* ── 길 이름 ── */}
        {/* 흰 테두리(halo)를 둘러 길·철길 위에서도 읽히게 한다. */}
        <g stroke="#fbf3ec" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
          {/* 기울여 길 위에 쓰면 걷는 길 점선과 겹친다. 길 서쪽에 가로로 둔다. */}
          <text x={104} y={150} textAnchor="end" fontSize={10.5} fontWeight={800} fill="#9a7f6b">
            영등포로 →
          </text>
          <text x={300} y={160} transform="rotate(27 300 160)" fontSize={9} fontWeight={800} fill={LINE1}>
            1호선
          </text>
        </g>

        {/* ── 역 ── 노선 색을 쓴다. */}
        {/* 5호선 역은 약도 왼쪽 끝에 걸려 있어 이름표가 잘리지 않게 안쪽으로 민다. */}
        <StationTag x={Math.max(p.line5[0], 14)} y={Math.max(p.line5[1], 16)} color={LINE5} line="5" />
        <StationTag x={p.line1[0]} y={p.line1[1]} color={LINE1} line="1" />

        {/* ── 길 위 표지 ── */}
        <Landmark x={p.cu[0]} y={p.cu[1]} label="CU" anchor="start" />

        {/* ── 단계 배지 ── */}
        <StepBadge x={p.exit1[0]} y={p.exit1[1]} n={1} />
        <Callout x={p.exit1[0] + 13} y={p.exit1[1] + 4} text="1번 출구" />

        <StepBadge x={p.busDaeyun[0] - 4} y={p.busDaeyun[1] - 20} n={2} />
        <Callout x={p.busDaeyun[0] - 46} y={p.busDaeyun[1] + 20} text="대윤병원 정류장" />

        {/* ── 교회 ── */}
        <Church x={p.church[0]} y={p.church[1]} />
        <StepBadge x={p.entrance[0] - 2} y={p.entrance[1] + 2} n={3} />

        {/* ── 방위와 축척 ── */}
        <g transform={`translate(${W - 22} 22)`}>
          <circle r={12} fill="#ffffff" stroke="#ead9cb" />
          <path d="M0,-8 L4,3 L0,0.5 L-4,3 Z" fill={BRAND} />
          <text y={-14} textAnchor="middle" fontSize={7} fontWeight={700} fill="#9c9088">
            N
          </text>
        </g>
        <g transform={`translate(12 ${H - 14})`}>
          <path d={`M0,0 L${HUNDRED_METERS},0`} stroke="#9c9088" strokeWidth={1.5} />
          <path d={`M0,-3 L0,3 M${HUNDRED_METERS},-3 L${HUNDRED_METERS},3`} stroke="#9c9088" strokeWidth={1.5} />
          <text x={HUNDRED_METERS + 5} y={3} fontSize={8} fill="#9c9088">
            100m
          </text>
        </g>
        <text x={W - 6} y={H - 6} textAnchor="end" fontSize={6} fill="#b8aca3">
          © OpenStreetMap
        </text>
      </svg>
    </figure>
  );
}

function StepBadge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={9} fill={BRAND} stroke="#ffffff" strokeWidth={2.5} />
      <text y={3.6} textAnchor="middle" fontSize={10} fontWeight={800} fill="#ffffff">
        {n}
      </text>
    </g>
  );
}

/** 흰 말풍선 이름표. */
function Callout({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 9 + 12;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={-11} width={w} height={17} rx={8.5} fill="#ffffff" stroke="#ead9cb" />
      <text x={w / 2} y={1.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#4a3f38">
        {text}
      </text>
    </g>
  );
}

function StationTag({ x, y, color, line }: { x: number; y: number; color: string; line: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-5} y={-9} width={62} height={18} rx={9} fill="#ffffff" stroke={color} strokeWidth={1.5} />
      <circle cx={4} cy={0} r={6.5} fill={color} />
      <text x={4} y={3.2} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#ffffff">
        {line}
      </text>
      <text x={14} y={3.5} fontSize={9.5} fontWeight={700} fill="#3d3530">
        신길역
      </text>
    </g>
  );
}

function Landmark({
  x,
  y,
  label,
  anchor,
}: {
  x: number;
  y: number;
  label: string;
  anchor: "start" | "end";
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-3.5} y={-3.5} width={7} height={7} rx={2} fill="#d8c3b2" />
      <text
        x={anchor === "start" ? 7 : -7}
        y={3}
        textAnchor={anchor}
        fontSize={8.5}
        fontWeight={600}
        fill="#8c7d72"
      >
        {label}
      </text>
    </g>
  );
}

/** 교회 건물. 지붕과 십자가만으로 한눈에 알아보게 그린다. */
function Church({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={17} rx={24} ry={5} fill="#000000" opacity={0.06} />
      <rect x={-16} y={-4} width={32} height={21} rx={3} fill="#ffffff" stroke={BRAND} strokeWidth={2} />
      <path d="M-19,-3 L0,-18 L19,-3 Z" fill={BRAND} />
      <path d="M0,-30 L0,-19 M-4,-26 L4,-26" stroke={BRAND} strokeWidth={2.2} strokeLinecap="round" />
      <rect x={-4.5} y={6} width={9} height={11} rx={4.5} fill={BRAND} opacity={0.85} />
      <g transform="translate(0 -40)">
        <rect x={-27} y={-10} width={54} height={18} rx={9} fill={BRAND} />
        <text y={3.4} textAnchor="middle" fontSize={10} fontWeight={800} fill="#ffffff">
          신길교회
        </text>
      </g>
    </g>
  );
}
