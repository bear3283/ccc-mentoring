/**
 * 요청 속도 제한.
 *
 * 막으려는 것: 참여코드 조회를 반복 호출해 "누가 신청했는지" 캐내는 행위와,
 * 로그인 비밀번호 무차별 대입.
 *
 * 메모리에만 기록하므로 서버 인스턴스가 여러 개면 인스턴스마다 따로 센다.
 * 자동화 공격을 완전히 막지는 못하고 속도를 크게 떨어뜨리는 수준이다.
 * 실제 트래픽이 커지면 Upstash Redis 같은 공유 저장소로 옮겨야 한다.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 오래된 항목이 계속 쌓이지 않도록 가끔 청소한다. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** 남은 횟수 */
  remaining: number;
  /** 다시 시도할 수 있을 때까지 남은 초 */
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * 요청자를 구분할 값.
 * 프록시 뒤에 있으면 X-Forwarded-For의 첫 주소가 실제 클라이언트다.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

/** 화면에 그대로 보여줄 수 있는 안내 문구. */
export function tooManyRequestsMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return minutes <= 1
    ? "요청이 너무 잦아요. 잠시 후 다시 시도해주세요."
    : `요청이 너무 잦아요. ${minutes}분 후 다시 시도해주세요.`;
}
