/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { describe, expect, it } from "vitest";
import { Problem } from "pagopa-interop-models";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { app } from "../vitest.api.setup.js";

describe("API GET /status test", () => {
  const { HTTP_STATUS_OK } = constants;

  const expectedHealthProblem: Problem = {
    type: "about:blank",
    correlationId: expect.any(String),
    status: HTTP_STATUS_OK,
    title: "Service status OK",
  };

  const makeRequest = async () =>
    app.inject({
      method: "GET",
      url: "/status",
    });

  it("Should return 200 when the service is healthy", async () => {
    const res = await makeRequest();
    const apiResponse = notificationConfigApi.zProblem.safeParse(res.json());

    expect(apiResponse.success).toBeTruthy();
    expect(res.statusCode).toBe(HTTP_STATUS_OK);
    expect(res.json()).toEqual(expectedHealthProblem);
  });
});
