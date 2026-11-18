/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId, Problem } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockPurposeSeed } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposes test", () => {
  const mockPurposeSeed = getMockPurposeSeed();
  // TODO REVIEW THIS CHANGE
  // eslint-disable-next-line interop/require-type-for-object
  const mockCreatedResource = {
    id: generateId(),
  };

  beforeEach(() => {
    clients.purposeProcessClient.createPurpose = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.PurposeSeed = mockPurposeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it("Should return 404 for an e-service with a NIL UUID", async () => {
    const eserviceId: string = "00000000-0000-0000-0000-000000000000";
    const detail: string = `EService ${eserviceId} not found`;
    const problem: Problem = {
      type: "about:blank",
      title: "EService not found",
      status: 404,
      detail,
      errors: [{ code: "004-0002", detail }],
    };
    vi.mocked(clients.purposeProcessClient.createPurpose).mockRejectedValueOnce(
      new AxiosError(problem.title, undefined, undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        data: problem,
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      })
    );

    const token: string = generateToken(authRole.ADMIN_ROLE);
    const res: request.Response = await makeRequest(token, {
      ...mockPurposeSeed,
      eserviceId,
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(problem);
  });

  it.each([
    { body: {} },
    { body: { title: "Mock purpose title" } },
    {
      body: {
        ...mockPurposeSeed,
        eserviceId: "invalid",
      },
    },
    {
      body: {
        ...mockPurposeSeed,
        extraField: 1,
      },
    },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.PurposeSeed);
    expect(res.status).toBe(400);
  });
});
