import { constants } from "http2";
import { piiValidatorApi } from "pagopa-interop-api-clients";
import { Problem } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";

describe("API GET /status", () => {
  it("returns the standard healthy response", async () => {
    const api = await createApp();
    const response = await request(api).get("/status");
    const parsed = piiValidatorApi.Problem.safeParse(response.body);

    const expected: Problem = {
      type: "about:blank",
      correlationId: expect.any(String),
      status: constants.HTTP_STATUS_OK,
      title: "Service status OK",
    };

    expect(parsed.success).toBe(true);
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
    expect(response.body).toEqual(expected);
  });
});
