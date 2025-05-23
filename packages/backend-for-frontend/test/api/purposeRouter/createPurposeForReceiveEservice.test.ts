/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockReversePurposeSeed } from "../../mockUtils.js";

describe("API POST /reverse/purposes test", () => {
  const mockPurposeSeed = getMockReversePurposeSeed();
  const mockCreatedResource = {
    id: generateId(),
  };

  beforeEach(() => {
    clients.purposeProcessClient.createPurposeFromEService = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.PurposeEServiceSeed = mockPurposeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/reverse/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
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
    const res = await makeRequest(token, body as bffApi.PurposeEServiceSeed);
    expect(res.status).toBe(400);
  });
});
