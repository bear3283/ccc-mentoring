export const ROLES = ["MENTEE", "MENTOR", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];

/** DB의 Users.role 과 1:1 대응. 화면 분기의 유일한 기준이다. */
export const ROLE_LABEL: Record<Role, string> = {
  MENTEE: "멘티",
  MENTOR: "멘토",
  ADMIN: "운영자",
};
