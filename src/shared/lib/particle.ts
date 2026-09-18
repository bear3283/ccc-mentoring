/**
 * 한국어 조사 선택.
 *
 * 선택지(학과·영역·캠퍼스)를 문장에 끼워 넣는 화면이 여러 곳이라
 * "학점관리을(를)" 같은 표기가 그대로 참가자에게 보인다.
 * 앞말의 받침을 보고 고르면 되는 일이라 함수로 둔다.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
/** 한글 한 글자는 초성×21×28 로 배열되어 있어, 28로 나눈 나머지가 곧 받침이다. */
const JONGSEONG_COUNT = 28;

/**
 * 받침이 있으면 true.
 *
 * 한글이 아닌 글자(영문·숫자)로 끝나면 판단할 수 없다. 이때는 false 를 주어
 * 받침 없는 쪽을 쓴다 — "AI를" 처럼 읽히는 편이 "AI을" 보다 낫다.
 */
function hasFinalConsonant(word: string): boolean {
  const last = word.trim().at(-1);
  if (!last) return false;

  const code = last.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return false;

  return (code - HANGUL_START) % JONGSEONG_COUNT !== 0;
}

/**
 * 앞말에 맞는 조사를 붙여 돌려준다.
 *
 * 예) particle("학점관리", "을", "를") -> "를"
 *     particle("전공공부", "을", "를") -> "을"
 */
export function particle(word: string, withFinal: string, withoutFinal: string): string {
  return hasFinalConsonant(word) ? withFinal : withoutFinal;
}

/**
 * 목적격 조사. `${areas}${objectParticle(areas)}` 형태로 쓴다.
 *
 * 주격(이/가)·보조사(은/는)가 필요해지면 particle() 로 그때 만들면 된다.
 * 쓰지 않는 함수를 미리 두면 어느 것이 실제로 쓰이는지 알 수 없게 된다.
 */
export function objectParticle(word: string): string {
  return particle(word, "을", "를");
}
