"""
캠퍼스마다 대략의 위치(시·군·구 중심점)를 만든다.

  python3 scripts/build-campus-locations.py

지망 캠퍼스에 선배가 없을 때 "가까운 캠퍼스 선배"를 고르는 데 쓴다.
건물 단위로 정확할 필요는 없고, 수원에서 서울 강남과 노원 중 어디가 가까운지 가를 수 있으면 된다.

  - 학교 소재지: 대학알리미 공시자료의 (학과)소재지 · (학과)소재지(상세) (build-campus-majors.py 와 같은 엑셀)
  - 시·군·구 중심점: 통계청 MDIS 행정경계 중심점 (UTM-K, 미터)
      https://github.com/vuski/admdongkor

UTM-K 는 미터 단위 평면 좌표라 두 점의 거리를 피타고라스로 바로 잴 수 있다.
결과는 src/shared/constants/campusLocation.generated.ts 에 km 단위로 쓴다.
"""

import importlib.util
import json
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("majors", HERE / "build-campus-majors.py")
majors = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(majors)

CENTROID_URL = (
    "https://raw.githubusercontent.com/vuski/admdongkor/master/"
    "%ED%86%B5%EA%B3%84%EC%B2%ADMDIS%EC%9D%B8%EA%B5%AC%EC%9A%A9_%ED%96%89%EC%A0%95%EA%B2%BD%EA%B3%84%EC%A4%91%EC%8B%AC%EC%A0%90/"
    "coordinate_UTMK_%EC%9D%B4%EB%A6%84%ED%8F%AC%ED%95%A8.tsv"
)
CENTROID_CACHE = HERE / ".cache-centroid.tsv"
OUT = HERE.parent / "src/shared/constants/campusLocation.generated.ts"

# 공시자료의 짧은 시·도 이름 -> 중심점 자료의 이름. 이름이 바뀐 곳은 둘 다 둔다.
SIDO = {
    "서울": ["서울특별시"],
    "부산": ["부산광역시"],
    "대구": ["대구광역시"],
    "인천": ["인천광역시"],
    "광주": ["광주광역시"],
    "대전": ["대전광역시"],
    "울산": ["울산광역시"],
    "세종": ["세종특별자치시"],
    "경기": ["경기도"],
    "강원": ["강원특별자치도", "강원도"],
    "충북": ["충청북도"],
    "충남": ["충청남도"],
    "전북": ["전북특별자치도", "전라북도"],
    "전남": ["전라남도"],
    "경북": ["경상북도"],
    "경남": ["경상남도"],
    "제주": ["제주특별자치도"],
}

# 공시자료에 없는 학교(build-campus-majors.py 의 MANUAL 에 빈 목록)의 소재지.
MANUAL_LOCATION = {
    "백석예술대": ("서울", "서초구"),
}


def load_centroids() -> dict[str, tuple[float, float]]:
    if not CENTROID_CACHE.exists():
        print("행정경계 중심점 자료를 받는 중…")
        with urllib.request.urlopen(CENTROID_URL, timeout=120) as res:
            CENTROID_CACHE.write_bytes(res.read())
    rows = {}
    for line in CENTROID_CACHE.read_text(encoding="utf-8").splitlines()[1:]:
        _, code, name, x, y = line.split("\t")
        # 읍·면·동은 쓰지 않는다. 코드 뒤 5자리가 0이면 시·도 또는 시·군·구다.
        if code.endswith("00000"):
            rows[name] = (float(x), float(y))
    return rows


def locate(centroids, sido: str, detail: str) -> tuple[float, float] | None:
    for full in SIDO[sido]:
        if not detail:
            if full in centroids:
                return centroids[full]
            continue
        name = f"{full} {detail}"
        if name in centroids:
            return centroids[name]
        # 구가 있는 시("성남시")는 자료에 구 단위로만 있다. 구 중심점의 평균을 쓴다.
        parts = [xy for n, xy in centroids.items() if n.startswith(name + " ")]
        if parts:
            return (
                sum(x for x, _ in parts) / len(parts),
                sum(y for _, y in parts) / len(parts),
            )
    # 세종처럼 시·군·구가 없는 곳은 시·도 중심점으로 물러선다.
    for full in SIDO[sido]:
        if full in centroids:
            return centroids[full]
    return None


def main() -> None:
    centroids = load_centroids()

    it = majors.read_rows(majors.download())
    for _ in range(3):
        next(it)
    header = next(it)
    idx = {h: i for i, h in enumerate(header)}

    def cell(row, key):
        i = idx[key]
        return row[i] if i < len(row) else ""

    # 학교마다 학과 행의 소재지 중 가장 많은 것을 그 학교 위치로 본다.
    places: dict[str, Counter] = {}
    for row in it:
        if cell(row, "대학구분") not in majors.DEGREE or "사이버" in cell(row, "학교구분"):
            continue
        key = f"{cell(row, '학교명')}|{cell(row, '본분교')}"
        places.setdefault(key, Counter())[(cell(row, "(학과)소재지"), cell(row, "(학과)소재지(상세)"))] += 1

    mapping = majors.map_campuses(sorted(places))
    out_rows: dict[str, tuple[float, float]] = {}
    missing = []
    for campus, keys in mapping.items():
        if campus in MANUAL_LOCATION:
            sido, detail = MANUAL_LOCATION[campus]
        elif keys and keys[0] in places:
            # 여러 캠퍼스를 합친 학교는 첫 키(본교)의 위치를 쓴다.
            sido, detail = places[keys[0]].most_common(1)[0][0]
        else:
            missing.append(campus)
            continue
        xy = locate(centroids, sido, detail) if sido in SIDO else None
        if not xy:
            missing.append(f"{campus}({sido} {detail})")
            continue
        out_rows[campus] = (round(xy[0] / 1000, 1), round(xy[1] / 1000, 1))

    if missing:
        raise SystemExit("위치를 찾지 못한 캠퍼스: " + ", ".join(missing))

    out = [
        "/**",
        " * 캠퍼스 위치(시·군·구 중심점). 손으로 고치지 마세요 — 생성된 파일입니다.",
        " *",
        " * UTM-K 평면 좌표를 km 로 나타낸 [x, y]. 두 캠퍼스의 거리는 피타고라스로 잰다.",
        " * 출처: 대학알리미 학과 소재지 + 통계청 MDIS 행정경계 중심점(github.com/vuski/admdongkor)",
        " *",
        " * 재생성: python3 scripts/build-campus-locations.py",
        " */",
        "",
        "export const CAMPUS_LOCATION: Record<string, readonly [number, number]> = {",
    ]
    for campus in sorted(out_rows):
        x, y = out_rows[campus]
        out.append(f"  {json.dumps(campus, ensure_ascii=False)}: [{x}, {y}],")
    out += ["};", ""]
    OUT.write_text("\n".join(out), encoding="utf-8")
    print(f"완료: {OUT.relative_to(HERE.parent)} · 캠퍼스 {len(out_rows)}개")


if __name__ == "__main__":
    main()
