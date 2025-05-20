/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurpose } from "../../mockUtils.js";
import {
  agreementNotFound,
  eServiceNotFound,
  eserviceDescriptorNotFound,
  tenantNotFound,
} from "../../../src/model/errors.js";

describe("API GET /purposes/{purposeId} test", () => {
  const mockPurpose = getMockBffApiPurpose();

  beforeEach(() => {
    services.purposeService.getPurpose = vi.fn().mockResolvedValue(mockPurpose);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id
  ) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurpose);
  });

  it.each([
    { error: tenantNotFound(generateId()), expectedStatus: 404 },
    { error: eServiceNotFound(generateId()), expectedStatus: 404 },
    { error: agreementNotFound(generateId()), expectedStatus: 404 },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.purposeService.getPurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeId);
    expect(res.status).toBe(400);
  });
});
