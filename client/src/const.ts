export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const isPrivateIpv4 = (host: string) => {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

export const isLocalPreviewHost = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return LOCAL_PREVIEW_HOSTS.has(host) || isPrivateIpv4(host);
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  if (isLocalPreviewHost()) {
    return "/";
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  if (!oauthPortalUrl || !appId) {
    return "/";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const baseUrl = oauthPortalUrl.endsWith("/")
      ? oauthPortalUrl
      : `${oauthPortalUrl}/`;
    const url = new URL("app-auth", baseUrl);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch {
    return "/";
  }
};
