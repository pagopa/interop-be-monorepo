/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /reverse/purposes test", () => {
  const mockPurposeSeed = {
    eserviceId: generateId(),
    consumerId: generateId(),
    riskAnalysisId: generateId(),
    title: generateMock(z.string()),
    description: generateMock(z.string()),
    isFreeOfCharge: generateMock(z.boolean()),
    freeOfChargeReason: generateMock(z.string().optional()),
    dailyCalls: generateMock(z.number().int().min(0)),
  };
  const mockCreatedResource = {
    id: generateId(),
  };

  beforeEach(() => {
    clients.purposeProcessClient.createPurposeFromEService = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (token: string, data: object = mockPurposeSeed) =>
    request(api)
      .post(`${appBasePath}/reverse/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it("Should return 400 if passed an invalid purpose seed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, { title: "Mock purpose title" });
    expect(res.status).toBe(400);
  });
});
