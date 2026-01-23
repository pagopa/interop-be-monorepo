import { agreementApi } from "pagopa-interop-api-clients";
import { describe, expect, it } from "vitest";
import { api } from "../vitest.api.setup.js";
import request from "supertest";
import { Problem } from "pagopa-interop-models";
import { constants } from "http2";

describe("API GET /status test", () => {
  const { HTTP_STATUS_OK } = constants;

  const expectedHealthProblem: Problem = {
    type: "about:blank",
    correlationId: expect.any(String),
    status: HTTP_STATUS_OK,
    title: "Service status OK",
  };

  const makeRequest = async () => request(api).get("/status");

  it("Should return 200 when the service is healthy", async () => {
    const res = await makeRequest();
    const apiResponse = agreementApi.Problem.safeParse(res.body);

    expect(apiResponse.success).toBeTruthy();
    expect(res.status).toBe(HTTP_STATUS_OK);
    expect(res.body).toEqual(expectedHealthProblem);
  });
});
