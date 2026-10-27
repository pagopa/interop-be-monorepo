import { Request, Response, NextFunction } from "express";
import { constants } from "http2";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("pagopa-interop-application-audit", () => ({
  applicationAuditBeginMiddleware: vi.fn(
    async () => (_req: Request, _res: Response, next: NextFunction) => next()
  ),
  applicationAuditEndMiddleware: vi.fn(
    async () => (_req: Request, _res: Response, next: NextFunction) => next()
  ),
}));

vi.stubEnv("HOST", "http://localhost");
vi.stubEnv("PORT", "3000");
vi.stubEnv("LOG_LEVEL", "info");
vi.stubEnv("WELL_KNOWN_URLS", "http://localhost:3000/jwks");
vi.stubEnv("ACCEPTED_AUDIENCES", "test");

const { createApp } = await import("../src/app.js");
const app = await createApp();

describe("personal data manager HTTP setup", () => {
  it("exposes the health check without authentication", async () => {
    const response = await request(app).get("/status");
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.body).toMatchObject({ title: "Service status OK" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects unauthenticated requests before protected routes", async () => {
    const response = await request(app)
      .get("/protected")
      .set("X-Correlation-Id", "c5f12e6b-ef2f-4aba-a365-126be9b73ed0");
    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.body.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
  });
});
