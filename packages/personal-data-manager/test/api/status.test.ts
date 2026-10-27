import { constants } from "http2";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { api } from "../vitest.api.setup.js";

describe("personal data manager HTTP setup", () => {
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
});
