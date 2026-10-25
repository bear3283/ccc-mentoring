/**
 * 행사 장소 정보.
 *
 * 화면 여러 곳(약도, 매칭 결과, 안내문)에서 같은 값을 쓰므로 여기 한 곳만 고친다.
 * 교회 안에서 만날 자리는 안내하지 않는다. 오시는 길만 보여준다.
 * 교통편은 신길교회 공식 홈페이지(shingil.kr)의 '오시는길' 기준이다.
 */

export interface TransitRoute {
  /** 노선 이름. 지하철은 호선, 버스는 색상 구분 */
  line: string;
  /** 노선을 구분하는 색 (Tailwind 클래스가 아니라 실제 색상값) */
  color: string;
  /** 내리는 곳과 이동 방법 */
  detail: string;
}

/**
 * 고3채플 날짜. 2026년 11월 26일 목요일.
 *
 * 월은 0부터 센다 — 10 이 11월이다.
 * 시각을 자정으로 두는 이유: 당일에는 아직 '지난 행사'가 아니어야 한다.
 */
export const EVENT_DATE = new Date(2026, 10, 26);

/** "11월 26일 (목)" — 화면에 그대로 쓴다. */
export const EVENT_DATE_LABEL = "11월 26일 (목)";

/**
 * 행사 포스터.
 *
 * 넣는 법: 이미지를 public/ 에 두고 아래 주석을 풀어 경로와 설명을 적습니다.
 *   public/poster.jpg  ->  { src: "/poster.jpg", alt: "...", ratio: "3 / 4" }
 *
 * null 이면 랜딩에 아무것도 그리지 않습니다. 개발 중에는 자리만 점선으로
 * 표시해 어디에 들어가는지 보입니다(운영 빌드에서는 나오지 않습니다).
 *
 * alt 는 비워두지 마세요. 포스터에는 날짜·장소가 그림으로만 들어가는 경우가
 * 많아, 화면을 읽어 주는 기기를 쓰는 사람에게는 그 정보가 통째로 사라집니다.
 * ratio 는 포스터 비율("3 / 4", "1 / 1" 등). 넣어 두면 이미지를 받기 전에도
 * 자리가 잡혀 화면이 덜컥 움직이지 않습니다.
 */
export const EVENT_POSTER: { src: string; alt: string; ratio: string } | null = {
  src: "/poster.jpg",
  // 포스터의 글자는 그림이라 읽어 주는 기기에 전달되지 않는다. 여기에 옮겨 적는다.
  alt:
    "서울지구 CCC 고3초청채플 'RE:CHILL, 다시 칠하다' 포스터. 예비 27학번을 위한 채플. " +
    "2026년 11월 26일(목) 오후 7시, 박람회 오후 5시, 아이자야 씩스티원과 함께. 장소 신길교회. " +
    "에베소서 2장 10절: 우리는 그가 만드신 바라 그리스도 예수 안에서 선한 일을 위하여 " +
    "지으심을 받은 자니 이 일은 하나님이 전에 예비하사 우리로 그 가운데서 행하게 하려 하심이니라.",
  ratio: "1080 / 1350",
};

/**
 * 채플이 지났는지.
 *
 * 멘토링 신청은 행사 뒤에도 계속 열어 둔다. 다만 "채플 당일에 만나요" 같은
 * 문구를 그대로 두면 이미 지난 날을 기다리라고 안내하는 꼴이라,
 * 날짜를 전제하는 문장만 이 값으로 갈라 준다.
 *
 * 서버와 브라우저가 같은 답을 내야 화면이 깜빡이지 않으므로 날짜까지만 본다.
 */
export function isAfterEvent(now: Date = new Date()): boolean {
  const endOfEventDay = new Date(EVENT_DATE);
  endOfEventDay.setHours(23, 59, 59, 999);
  return now > endOfEventDay;
}

export const VENUE = {
  name: "신길교회",

  /** 운영진이 확인한 주소 (2026-10-25). */
  address: "서울 영등포구 영등포로67가길 9",
  phone: "02-831-2015",

  /** 사용자가 공유한 네이버 지도 링크. 실제 길찾기는 여기로 넘긴다. */
  naverMapUrl: "https://naver.me/GOPmKFXg",

  /**
   * 약도의 핵심 경로. 대부분 이 길로 온다.
   * 여러 갈래를 한 번에 그리면 오히려 헤매므로 기본 경로 하나만 크게 보여준다.
   */
  primaryRoute: {
    station: "신길역",
    lines: ["1호선", "5호선"],
    exit: "1번 출구",
    walkMinutes: 3,
  },

  subway: [
    { line: "1호선", color: "#0052A4", detail: "신길역 1번 출구 → 도보 3분" },
    { line: "5호선", color: "#996CAC", detail: "신길역에서 1호선 1번 출구로 이동 → 도보 3분" },
    { line: "1호선", color: "#0052A4", detail: "대방역 → 도보 15분" },
  ] satisfies TransitRoute[],

  /** 버스는 '신길 새마을금고' 정류장에서 내린다. */
  busStop: "신길 새마을금고",
  bus: [
    { line: "간선", color: "#3D5BAB", detail: "360, 361, 540, 541, 605, 640, 650" },
    {
      line: "지선",
      color: "#5BB025",
      detail: "5513, 5514, 5515, 5612, 5625, 5629, 5711, 6211, 6411, 6514",
    },
    { line: "광역", color: "#E60012", detail: "9408, 9412" },
  ] satisfies TransitRoute[],
} as const;

/**
 * 채플 당일(목) 몇 시에 올 수 있는지.
 *
 * 채플 날은 매칭된 선배·후배가 얼굴을 보고 인사하는 자리다. 1:1 멘토링은
 * 그 뒤에 따로 한 번 하고, 그 날짜는 매칭된 뒤 둘이 문자로 정한다.
 *
 * 매칭 점수에는 쓰지 않는다. 인사만 하는 자리라 도착 시간이 달라도
 * 문자로 맞추면 된다. 매칭된 상대와 운영자에게만 보여준다.
 *
 * DB 제약(users_event_arrival_check)과 같은 값이어야 한다.
 */
export const EVENT_ARRIVALS = ["1700", "1730", "1800", "1830", "1900_LATER", "ABSENT"] as const;
export type EventArrival = (typeof EVENT_ARRIVALS)[number];

export const EVENT_ARRIVAL_LABEL: Record<EventArrival, string> = {
  "1700": "오후 5시 ~ 5시 30분",
  "1730": "오후 5시 30분 ~ 6시",
  "1800": "오후 6시 ~ 6시 30분",
  "1830": "오후 6시 30분 ~ 7시",
  "1900_LATER": "오후 7시 이후",
  ABSENT: "당일엔 못 와요",
};

export function isEventArrival(value: unknown): value is EventArrival {
  return typeof value === "string" && (EVENT_ARRIVALS as readonly string[]).includes(value);
}
