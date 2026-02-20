/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  agreementNotFound,
  descriptorNotFound,
  eserviceNotFound,
} from "../../src/model/domain/errors.js";
import { updatedDailyCallsToApiUpdatedDailyCalls } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposes/updatedDailyCalls test", () => {
  const eserviceId: EServiceId = generateId();
  const descriptorId: DescriptorId = generateId();

  const apiResponse = purposeApi.UpdatedDailyCallsResponse.parse(
    updatedDailyCallsToApiUpdatedDailyCalls({
      eserviceId,
      descriptorId,
      updatedDailyCallsPerConsumer: 80,
      updatedDailyCallsTotal: 1800,
    })
  );

  beforeEach(() => {
    purposeService.getUpdatedDailyCalls = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (
    token: string,
    query: { eserviceId?: string; descriptorId?: string } = {
      eserviceId,
      descriptorId,
    }
  ) =>
    request(api)
      .get("/purposes/updatedDailyCalls")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, { eserviceId, descriptorId });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, { eserviceId, descriptorId });
    expect(res.status).toBe(403);
  });

  it.each([
    { query: {} },
    { query: { eserviceId } },
    { query: { descriptorId } },
    { query: { eserviceId: "invalid", descriptorId } },
    { query: { eserviceId, descriptorId: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query);
    expect(res.status).toBe(400);
  });

  it.each([
    {
      error: eserviceNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: descriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: agreementNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.getUpdatedDailyCalls = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
