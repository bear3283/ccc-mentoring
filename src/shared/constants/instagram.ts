import type { Campus } from "./campus";

/**
 * 캠퍼스별 CCC 인스타그램.
 *
 * 계정 아이디를 추측해서 넣지 않는다. 틀린 아이디는 404 가 아니라
 * 전혀 상관없는 사람의 계정으로 연결될 수 있다.
 *
 * 확인된 계정만 여기에 적고, 없는 캠퍼스는 인스타그램 검색으로 보낸다.
 * 운영진이 아이디를 확인하면 이 표에 한 줄씩 추가하면 된다.
 */
export const CAMPUS_INSTAGRAM: Partial<Record<Campus, string>> = {
  // 예시 형태 — 실제 계정을 확인한 뒤 주석을 풀고 채우세요.
  // 서울대: "snu_ccc",
  // 연세대: "yonsei_ccc",
};

/** 한국 CCC 공식 계정. 캠퍼스 계정을 모를 때의 기본값. */
export const CCC_OFFICIAL_INSTAGRAM = "kccc_official";

export interface InstagramLink {
  campus: string;
  url: string;
  /** 확인된 계정인지, 검색으로 보내는 중인지 */
  verified: boolean;
}

/**
 * 캠퍼스에 맞는 인스타그램 링크를 만든다.
 *
 * 아이디를 모르면 프로필 대신 검색 결과로 보낸다.
 * 없는 계정으로 보내는 것보다 낫고, 사용자가 직접 찾을 수 있다.
 */
export function instagramLinkFor(campus: string): InstagramLink {
  const handle = CAMPUS_INSTAGRAM[campus as Campus];

  if (handle) {
    return { campus, url: `https://instagram.com/${handle}`, verified: true };
  }

  return {
    campus,
    url: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(
      `${campus} CCC`,
    )}`,
    verified: false,
  };
}
