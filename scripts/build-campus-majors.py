"""
캠퍼스별 실제 학과 데이터를 대학알리미 공시자료에서 생성한다.

  python3 scripts/build-campus-majors.py

대학알리미 자료실의 엑셀을 내려받아
src/shared/constants/campusMajors.generated.ts 를 다시 쓴다.

공시자료는 해마다 갱신되므로, 자료가 바뀌면 ATTACHMENT_ID 와 SOURCE_LABEL 을
새 게시글 값으로 바꾸고 다시 돌리면 된다. 게시글의 첨부파일 링크에 걸린
fn_file_down('...') 안의 숫자가 ATTACHMENT_ID 다.

표준 라이브러리만 쓴다. xlsx 는 zip + XML 이라 openpyxl 없이도 읽힌다.
"""

import json
import re
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

BOARD_URL = (
    "https://www.academyinfo.go.kr/brd/brd0520/selectDetail.do"
    "?ntce_sntc_sno=160&bbs_gubun=rfbr&no=19"
)
DOWNLOAD_URL = "https://www.academyinfo.go.kr/file/FileDown.do"
ATTACHMENT_ID = "4580256"
SOURCE_LABEL = "2024.10.07. 기준"

OUT = Path(__file__).resolve().parent.parent / "src/shared/constants/campusMajors.generated.ts"
CACHE = Path(__file__).resolve().parent / ".cache-majors.xlsx"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# 앱의 계열 순서. campus.ts 의 MAJOR_FIELDS 와 같아야 한다.
FIELDS = ["인문", "사회", "상경", "자연", "공학", "의약·생명", "사범", "예체능"]

# 공시 학교명은 우리 표기와 다르다. 자동으로 맞출 수 없는 것만 적는다.
# 값이 여러 개인 곳은 본교와 제2캠퍼스를 한 학교로 합친다.
MANUAL = {
    "한국외대": ["한국외국어대학교|본교"],
    "이화여대": ["이화여자대학교|본교"],
    "숙명여대": ["숙명여자대학교|본교"],
    "서울여대": ["서울여자대학교|본교"],
    "성신여대": ["성신여자대학교|본교"],
    "덕성여대": ["덕성여자대학교|본교"],
    "동덕여대": ["동덕여자대학교|본교"],
    "서울교대": ["서울교육대학교|본교"],
    "한양대 에리카": ["한양대학교(ERICA)|분교"],
    "경인교대": ["경인교육대학교|본교", "경인교육대학교|제2캠퍼스"],
    "연세대 미래": ["연세대학교(미래)|분교"],
    "강릉원주대": ["국립강릉원주대학교|본교", "국립강릉원주대학교|제2캠퍼스"],
    "KAIST": ["한국과학기술원|본교"],
    "한밭대": ["국립한밭대학교|본교"],
    "공주대": ["국립공주대학교|본교"],
    "한국교통대": ["국립한국교통대학교|본교"],
    "단국대 천안": ["단국대학교|제2캠퍼스"],
    "건국대 글로컬": ["건국대학교(글로컬)|분교"],
    "고려대 세종": ["고려대학교(세종)|분교"],
    "홍익대 세종": ["홍익대학교|제2캠퍼스"],
    "군산대": ["국립군산대학교|본교"],
    "목포대": ["국립목포대학교|본교"],
    "순천대": ["국립순천대학교|본교"],
    "부경대": ["국립부경대학교|본교"],
    "창원대": ["국립창원대학교|본교"],
    "UNIST": ["울산과학기술원|본교"],
    "포항공대": ["포항공과대학교|본교"],
    "부산외대": ["부산외국어대학교|본교"],
    "한국해양대": ["국립한국해양대학교|본교"],
}


def download() -> Path:
    if CACHE.exists():
        print(f"캐시 사용: {CACHE.name} (다시 받으려면 지우세요)")
        return CACHE
    print("대학알리미에서 공시자료를 받는 중…")
    req = urllib.request.Request(
        DOWNLOAD_URL,
        data=f"atch_file_no={ATTACHMENT_ID}".encode(),
        headers={"User-Agent": "Mozilla/5.0", "Referer": BOARD_URL},
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        CACHE.write_bytes(res.read())
    print(f"  받음: {CACHE.stat().st_size / 1024 / 1024:.1f} MB")
    return CACHE


def read_rows(path: Path):
    """xlsx 를 한 줄씩 흘려 읽는다. 5만 행이라 통째로 올리면 메모리를 많이 쓴다."""
    z = zipfile.ZipFile(path)
    shared = []
    for _, el in ET.iterparse(z.open("xl/sharedStrings.xml"), events=("end",)):
        if el.tag == NS + "si":
            shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
            el.clear()
    for _, el in ET.iterparse(z.open("xl/worksheets/sheet1.xml"), events=("end",)):
        if el.tag == NS + "row":
            cells = []
            for c in el.iter(NS + "c"):
                v = c.find(NS + "v")
                if v is None:
                    cells.append("")
                elif c.get("t") == "s":
                    cells.append(shared[int(v.text)])
                else:
                    cells.append(v.text or "")
            yield cells
            el.clear()


# 공시자료에는 고3이 고를 수 없는 통계용 항목이 섞여 있다.
# "기타모집단위"를 선택지로 내밀면 무엇을 고르는 건지 알 수 없다.
NOISE = re.compile(r"기타모집단위|교양|기초교육|^$")


def clean_name(name: str) -> str:
    """표기를 하나로 맞춘다.

    같은 학부인데 가운뎃점이 U+30FB(・)와 U+00B7(·)로 갈려 들어와
    "물리・천문학부"와 "물리·천문학부"가 서로 다른 학과로 잡힌다.
    """
    return name.replace("・", "·").strip()


def drop_variants(majors: dict[str, str]) -> dict[str, str]:
    """괄호가 붙은 세부 전공은 본체가 있으면 뺀다.

    "물리·천문학부"와 "물리·천문학부(물리학전공)"가 나란히 보이면
    둘이 무엇이 다른지 고르는 사람이 알 수 없다. 본체만 남긴다.
    """
    kept = {}
    for name, field in majors.items():
        base = name.split("(")[0].strip()
        if base != name and base in majors:
            continue
        kept[name] = field
    return kept


def to_field(dae: str, jung: str) -> str:
    """공시의 대·중계열을 앱의 8개 계열로 옮긴다."""
    if dae == "공학계열":
        return "공학"
    if dae == "예체능계열":
        return "사범" if jung == "교육" else "예체능"
    if dae == "의학계열":
        return "의약·생명"
    if dae == "인문사회계열":
        if jung == "경영・경제":
            return "상경"
        if jung == "교육":
            return "사범"
        if jung in ("언어・문학", "인문학"):
            return "인문"
        # 사회과학·법학과 계열이 모호한 자유전공학부 등이 여기 모인다.
        return "사회"
    if dae == "자연과학계열":
        if jung == "교육":
            return "사범"
        if jung in ("간호", "보건", "약학", "의료예과"):
            return "의약·생명"
        return "자연"
    return "사회"


def campus_list() -> list[str]:
    """campus.ts 에서 캠퍼스 목록을 읽는다. 두 파일이 어긋나지 않게 원본을 따른다."""
    text = (OUT.parent / "campus.ts").read_text(encoding="utf-8")
    start = text.index("CAMPUSES_BY_REGION = {")
    block = text[start : text.index("} as const satisfies", start)]
    names = re.findall(r'"([^"]+)"', block)
    # 지역 이름은 객체의 키라 같이 잡힌다. 캠퍼스가 아니므로 뺀다.
    regions = {"서울", "경기·인천", "강원", "충청", "전라", "경상", "제주"}
    return [n for n in names if n not in regions]


def main() -> None:
    path = download()

    it = read_rows(path)
    for _ in range(3):  # 상단 안내 3줄
        next(it)
    header = next(it)
    idx = {h: i for i, h in enumerate(header)}

    def cell(row, key):
        i = idx[key]
        return row[i] if i < len(row) else ""

    by_school: dict[str, dict[str, str]] = defaultdict(dict)
    for row in it:
        # 4년제 · 학사 · 주간 · 살아 있는 학과만 남긴다.
        if cell(row, "대학구분") != "대학":
            continue
        if cell(row, "학위과정") != "학사":
            continue
        if cell(row, "주야간구분") != "주간":
            continue
        if "폐지" in cell(row, "학과상태"):
            continue
        major = clean_name(cell(row, "학부·과(전공)명"))
        if NOISE.search(major):
            continue
        key = f"{cell(row, '학교명')}|{cell(row, '본분교')}"
        by_school[key][major] = to_field(
            cell(row, "대계열분류"), cell(row, "중계열분류")
        )

    def normalize(s: str) -> str:
        return s.replace("대학교", "대").replace("대학", "대").replace(" ", "")

    school_keys = sorted(by_school)
    campuses = campus_list()
    mapping: dict[str, list[str]] = {}
    for campus in campuses:
        if campus in MANUAL:
            mapping[campus] = MANUAL[campus]
            continue
        hits = [k for k in school_keys if normalize(k.split("|")[0]) == normalize(campus)]
        main_only = [h for h in hits if h.endswith("|본교")]
        picked = main_only or hits
        if not picked:
            raise SystemExit(f"공시자료에서 '{campus}' 를 찾지 못했습니다. MANUAL 에 추가하세요.")
        mapping[campus] = picked[:1]

    per_campus: dict[str, list[str]] = {}
    # 같은 학과명이 학교마다 다른 계열로 공시되는 경우가 있다(예: 교육 vs 예체능).
    # 먼저 본 값으로 덮어쓰면 처리 순서에 따라 결과가 달라지므로 표를 모아 둔다.
    votes: dict[str, Counter] = defaultdict(Counter)
    for campus, keys in mapping.items():
        merged: dict[str, str] = {}
        for k in keys:
            merged.update(by_school.get(k, {}))
        merged = drop_variants(merged)
        if not merged:
            raise SystemExit(f"'{campus}' 에 남은 학과가 없습니다. 필터를 확인하세요.")
        per_campus[campus] = sorted(merged)
        for major, field in merged.items():
            votes[major][field] += 1

    # 가장 많이 쓰인 계열로 정한다. 동수면 FIELDS 순서가 앞선 쪽을 써서
    # 자료가 같으면 언제 돌려도 같은 파일이 나오게 한다.
    field_of = {
        major: min(c.items(), key=lambda kv: (-kv[1], FIELDS.index(kv[0])))[0]
        for major, c in votes.items()
    }

    names = sorted(field_of)
    at = {n: i for i, n in enumerate(names)}

    out = [
        "/**",
        " * 캠퍼스별 실제 학과. 손으로 고치지 마세요 — 생성된 파일입니다.",
        " *",
        f' * 출처: 교육부 대학알리미 "학교별 학부·과(전공) 리스트" ({SOURCE_LABEL})',
        f" *   {BOARD_URL}",
        " *",
        " * 4년제 대학 · 학사과정 · 주간 · 폐지되지 않은 학과만 남겼습니다.",
        " * 이름을 그대로 쓰면 같은 학과가 학교마다 중복 저장되므로,",
        " * 학과명을 MAJOR_NAMES 에 한 번만 두고 캠퍼스는 그 인덱스를 가집니다.",
        " *",
        " * 재생성: python3 scripts/build-campus-majors.py",
        " */",
        "",
        'import type { MajorField } from "./campus";',
        "",
        "/** 전국 학과명. 인덱스가 곧 식별자다. */",
        "export const MAJOR_NAMES: readonly string[] = [",
    ]
    for i in range(0, len(names), 6):
        out.append("  " + " ".join(json.dumps(x, ensure_ascii=False) + "," for x in names[i : i + 6]))
    out += [
        "];",
        "",
        "/** MAJOR_NAMES 와 같은 순서의 계열 인덱스. MAJOR_FIELD_ORDER 를 가리킨다. */",
        "export const MAJOR_FIELD_INDEX: readonly number[] = [",
    ]
    fidx = [FIELDS.index(field_of[n]) for n in names]
    for i in range(0, len(fidx), 40):
        out.append("  " + ",".join(str(x) for x in fidx[i : i + 40]) + ",")
    out += [
        "];",
        "",
        "/** MAJOR_FIELD_INDEX 가 가리키는 계열 순서. campus.ts 의 MAJOR_FIELDS 와 같아야 한다. */",
        "export const MAJOR_FIELD_ORDER: readonly MajorField[] = [",
        "  " + ", ".join(json.dumps(f, ensure_ascii=False) for f in FIELDS) + ",",
        "];",
        "",
        "/** 캠퍼스 -> 그 학교에 실제로 있는 학과의 MAJOR_NAMES 인덱스. */",
        "export const CAMPUS_MAJOR_INDEX: Record<string, readonly number[]> = {",
    ]
    for campus in sorted(per_campus):
        body = ",".join(str(at[m]) for m in sorted(per_campus[campus], key=lambda m: at[m]))
        out.append(f"  {json.dumps(campus, ensure_ascii=False)}: [{body}],")
    out += ["};", ""]

    OUT.write_text("\n".join(out), encoding="utf-8")
    print(f"완료: {OUT.relative_to(OUT.parent.parent.parent.parent)}")
    print(f"  캠퍼스 {len(per_campus)}개 · 고유 학과 {len(names)}개")


if __name__ == "__main__":
    main()
