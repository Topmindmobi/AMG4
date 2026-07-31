/**
 * Public site origin for redirects.
 * Standalone Next on Docker sets HOSTNAME=0.0.0.0, so `new URL(request.url).origin`
 * can become `http://0.0.0.0:3000` — never send users there after OAuth.
 */
export function getRequestOrigin(request: Request): string {
  // Prefer runtime-only vars (not inlined) so Docker/App Platform can set them
  // without a client rebuild. NEXT_PUBLIC_SITE_URL is a build-time fallback.
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* fall through */
    }
  }

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) || "https";

  if (forwardedHost && isPublicHost(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = firstHeaderValue(request.headers.get("host"));
  if (host && isPublicHost(host)) {
    const proto =
      firstHeaderValue(request.headers.get("x-forwarded-proto")) ||
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  const { origin } = new URL(request.url);
  if (isPublicHost(new URL(origin).host)) return origin;

  return "http://localhost:3000";
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

function isPublicHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    !h.startsWith("0.0.0.0") &&
    !h.startsWith("[::]") &&
    h !== "::" &&
    !h.startsWith("127.0.0.1")
  );
}
