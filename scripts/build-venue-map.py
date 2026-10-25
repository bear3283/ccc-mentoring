"""
오시는 길 약도의 길 모양을 OpenStreetMap 에서 받아 SVG 좌표로 바꾼다.

약도는 일러스트지만 길 모양은 실제와 같아야 한다. 손으로 그린 골목은 당일에
엉뚱한 길로 보낸다. 그래서 길·철길은 OSM 좌표를 그대로 옮기고, 걷는 길은
도보 길찾기(OSRM foot) 결과를 쓴다. 교회 좌표는 OSM 에 없어 네이버 지도
장소 정보(입구 좌표)를 적었다.

실행: python3 -I scripts/build-venue-map.py
결과: src/features/venue/lib/venueMapGeometry.generated.ts (직접 고치지 않는다)
"""

import json
import math
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

UA = "ccc-mentoring-venue-map/1.0"

# 약도에 담을 범위 (서·동 경도, 북·남 위도)
LON_W, LON_E, LAT_N, LAT_S = 126.9156, 126.9210, 37.5178, 37.5138
WIDTH = 360

# 신길역 1번 출구(OSM subway_entrance ref=1)와 신길교회 입구(네이버 지도).
EXIT_1 = (37.51684, 126.91710)
CHURCH_ENTRANCE = (37.514808, 126.919508)
CHURCH = (37.51519, 126.91970)
STATION_LINE1 = (37.51665, 126.91874)
STATION_LINE5 = (37.51751, 126.91635)
# 길 위 표지. 걷는 길에서 눈에 띄는 것만 고른다.
LANDMARKS = {
    "busDaeyun": (37.51453, 126.91815),  # 대윤병원 버스정류장 — 골목으로 꺾는 곳
    "cu": (37.51514, 126.91792),  # CU 편의점 — 영등포로를 걷는 중간
}

OUT = Path("src/features/venue/lib/venueMapGeometry.generated.ts")


def fetch(url: str) -> bytes:
    # urllib 대신 curl 을 쓴다. python.org 설치판은 인증서 설정이 없어 HTTPS 가 실패한다.
    return subprocess.run(
        ["curl", "-sf", "-m", "90", "-A", UA, url], check=True, capture_output=True
    ).stdout


def main() -> None:
    mx = math.cos(math.radians((LAT_N + LAT_S) / 2)) * 111320
    my = 110540
    scale = WIDTH / ((LON_E - LON_W) * mx)
    height = round((LAT_N - LAT_S) * my * scale)

    def point(lat: float, lon: float) -> tuple[float, float]:
        return (round((lon - LON_W) * mx * scale, 1), round((LAT_N - lat) * my * scale, 1))

    def path(pts: list[tuple[float, float]]) -> str:
        return "M" + " L".join("%s,%s" % point(a, b) for a, b in pts)

    osm = fetch(
        "https://api.openstreetmap.org/api/0.6/map"
        f"?bbox={LON_W - 0.0005},{LAT_S - 0.0005},{LON_E + 0.0005},{LAT_N + 0.0005}"
    )
    root = ET.fromstring(osm)
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}

    ways = []
    for way in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in way.iter("tag")}
        pts = [nodes[nd.get("ref")] for nd in way.iter("nd") if nd.get("ref") in nodes]
        if len(pts) >= 2:
            ways.append((tags, pts))

    # 영등포로 서쪽은 그리지 않는다. 걷는 길은 영등포로 동쪽 보도와 그 안쪽 골목뿐이라
    # 서쪽 골목은 눈만 어지럽힌다. 위도마다 영등포로가 지나는 경도를 구해 비교한다.
    spine = sorted(
        (pt for tags, pts in ways if tags.get("name") == "영등포로" and tags.get("highway") == "secondary"
         for pt in pts),
    )

    def road_lon_at(lat: float) -> float:
        below = [p for p in spine if p[0] <= lat]
        above = [p for p in spine if p[0] >= lat]
        if not below:
            return above[0][1]
        if not above:
            return below[-1][1]
        (a_lat, a_lon), (b_lat, b_lon) = below[-1], above[0]
        if b_lat == a_lat:
            return a_lon
        return a_lon + (b_lon - a_lon) * (lat - a_lat) / (b_lat - a_lat)

    def west_of_road(pts: list[tuple[float, float]]) -> bool:
        west = sum(1 for lat, lon in pts if lon < road_lon_at(lat) - 0.00005)
        return west > len(pts) / 2

    roads: dict[str, list[str]] = {"main": [], "minor": []}
    line1: list[tuple[float, float]] = []
    line5: list[str] = []
    for tags, pts in ways:
        hw, rw = tags.get("highway"), tags.get("railway")
        if hw in ("primary", "secondary"):
            if tags.get("name") == "영등포로" or not west_of_road(pts):
                roads["main"].append(path(pts))
        elif hw in ("tertiary", "residential", "unclassified", "living_street"):
            if not west_of_road(pts):
                roads["minor"].append(path(pts))
        elif rw == "rail" and len(pts) > len(line1):
            # 1호선(경부선)은 선로가 여러 가닥이다. 노선 하나로만 그리려고 가장 긴 가닥 하나를 쓴다.
            line1 = pts
        elif rw == "subway" and tags.get("name") == "5호선":
            line5.append(path(pts))

    route = json.loads(
        fetch(
            "https://routing.openstreetmap.de/routed-foot/route/v1/foot/"
            f"{EXIT_1[1]},{EXIT_1[0]};{CHURCH_ENTRANCE[1]},{CHURCH_ENTRANCE[0]}"
            "?overview=full&geometries=geojson"
        )
    )["routes"][0]
    walk = path([(lat, lon) for lon, lat in route["geometry"]["coordinates"]])

    points = {
        "exit1": point(*EXIT_1),
        "church": point(*CHURCH),
        "entrance": point(*CHURCH_ENTRANCE),
        "line1": point(*STATION_LINE1),
        "line5": point(*STATION_LINE5),
        **{k: point(*v) for k, v in LANDMARKS.items()},
    }
    meters_per_px = 1 / scale

    body = {
        "width": WIDTH,
        "height": height,
        "metersPerPx": round(meters_per_px, 3),
        "walkMeters": round(route["distance"]),
        "main": " ".join(roads["main"]),
        "minor": " ".join(roads["minor"]),
        "line1": path(line1),
        # 5호선은 상·하행 두 가닥이 거의 겹친다. 하나만 그린다.
        "line5": line5[0] if line5 else "",
        "walk": walk,
        "points": points,
    }
    OUT.write_text(
        "// scripts/build-venue-map.py 가 만든 파일. 직접 고치지 않는다.\n"
        "// 길·철길: © OpenStreetMap contributors (ODbL). 걷는 길: OSRM foot.\n"
        f"export const VENUE_MAP = {json.dumps(body, ensure_ascii=False, indent=2)} as const;\n",
        encoding="utf-8",
    )
    print(f"{OUT} — {WIDTH}x{height}, 걷는 길 {body['walkMeters']}m")


if __name__ == "__main__":
    main()
