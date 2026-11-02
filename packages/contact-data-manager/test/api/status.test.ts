import { constants } from "http2";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import winston from "winston";

import { api } from "../vitest.api.setup.js";

describe("contact data manager HTTP setup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("exposes the health check without authentication", async () => {
    const response = await request(api).get("/status");
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.body).toMatchObject({ title: "Service status OK" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects unauthenticated requests before protected routes", async () => {
    const response = await request(api)
      .get("/protected")
      .set("X-Correlation-Id", "c5f12e6b-ef2f-4aba-a365-126be9b73ed0");
    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.body.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
  });

  it("rejects malformed JSON without exposing request fragments", async () => {
    const email = "a@b.it";
    const logs = vi.spyOn(winston.Logger.prototype, "log");
    const response = await request(api)
      .post("/contacts")
      .set("Content-Type", "application/json")
      .send(`{"email":${email}}`);

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.body.detail).toBe("Invalid request body");
    expect(JSON.stringify(response.body)).not.toContain(email);
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });
});
