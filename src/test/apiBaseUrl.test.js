import { describe, expect, it } from "vitest";

import {
  parseBooleanEnv,
  resolveApiBaseUrl,
} from "../../client/lib/apiBaseUrl.js";

describe("resolveApiBaseUrl", () => {
  it("uses the local gateway when localhost is open even if a deployment API URL is configured", () => {
    const apiBaseUrl = resolveApiBaseUrl({
      configuredApiBaseUrl: "http://16.170.18.188:8080",
      gatewayPort: "8080",
      isDev: true,
      locationLike: {
        protocol: "http:",
        hostname: "localhost",
        origin: "http://localhost:5173",
      },
    });

    expect(apiBaseUrl).toBe("http://localhost:8080");
  });

  it("keeps an explicitly local API override for local pages", () => {
    const apiBaseUrl = resolveApiBaseUrl({
      configuredApiBaseUrl: "http://127.0.0.1:9090",
      gatewayPort: "8080",
      isDev: true,
      locationLike: {
        protocol: "http:",
        hostname: "localhost",
        origin: "http://localhost:5173",
      },
    });

    expect(apiBaseUrl).toBe("http://127.0.0.1:9090");
  });

  it("uses the configured deployment API URL for public hosts", () => {
    const apiBaseUrl = resolveApiBaseUrl({
      configuredApiBaseUrl: "http://16.170.18.188:8080",
      gatewayPort: "8080",
      isDev: false,
      locationLike: {
        protocol: "http:",
        hostname: "16.170.18.188",
        origin: "http://16.170.18.188",
      },
    });

    expect(apiBaseUrl).toBe("http://16.170.18.188:8080");
  });

  it("falls back to the same origin in production when no deployment API URL is configured", () => {
    const apiBaseUrl = resolveApiBaseUrl({
      configuredApiBaseUrl: "",
      gatewayPort: "8080",
      isDev: false,
      locationLike: {
        protocol: "http:",
        hostname: "16.170.18.188",
        origin: "http://16.170.18.188",
      },
    });

    expect(apiBaseUrl).toBe("http://16.170.18.188");
  });
});

describe("parseBooleanEnv", () => {
  it("defaults to false when the variable is missing", () => {
    expect(parseBooleanEnv(undefined, false)).toBe(false);
  });

  it("treats true values case-insensitively", () => {
    expect(parseBooleanEnv("TRUE", false)).toBe(true);
  });
});
