export function trimTrailingSlash(value) {
  return value ? value.replace(/\/+$/, "") : "";
}

export function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() === "true";
}

export function isLoopbackHost(hostname) {
  if (!hostname) {
    return false;
  }

  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "[::1]"
    || normalized.endsWith(".localhost");
}

export function isPrivateIpv4Host(hostname) {
  if (!hostname) {
    return false;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) {
    return false;
  }

  const secondOctet = Number.parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

export function isLocalRuntimeHost(hostname) {
  return isLoopbackHost(hostname) || isPrivateIpv4Host(hostname);
}

export function isLocalApiBaseUrl(apiBaseUrl) {
  if (!apiBaseUrl) {
    return false;
  }

  try {
    return isLocalRuntimeHost(new URL(apiBaseUrl).hostname);
  } catch {
    return false;
  }
}

export function buildGatewayBaseUrl(protocol, hostname, gatewayPort) {
  if (!protocol || !hostname || !gatewayPort) {
    return "";
  }

  return trimTrailingSlash(`${protocol}//${hostname}:${gatewayPort}`);
}

export function resolveApiBaseUrl({
  configuredApiBaseUrl = "",
  gatewayPort = "8080",
  isDev = false,
  locationLike,
} = {}) {
  const configured = trimTrailingSlash(configuredApiBaseUrl);
  if (!locationLike) {
    return configured;
  }

  const protocol = locationLike.protocol || "";
  const hostname = locationLike.hostname || "";
  const origin = locationLike.origin || "";

  if (!hostname) {
    return configured;
  }

  const localGatewayUrl = buildGatewayBaseUrl(protocol, hostname, gatewayPort);
  if (isLocalRuntimeHost(hostname)) {
    return configured && isLocalApiBaseUrl(configured)
      ? configured
      : localGatewayUrl;
  }

  if (configured) {
    return configured;
  }

  if (isDev) {
    return localGatewayUrl;
  }

  return trimTrailingSlash(origin);
}
