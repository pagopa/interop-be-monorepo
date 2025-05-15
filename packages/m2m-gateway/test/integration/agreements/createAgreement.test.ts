import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import { getMockedApiAgreement } from "../../mockUtils.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";

describe("POST /agreements router test", () => {
  const mockAgreementSeed: m2mGatewayApi.AgreementSeed = generateMock(
    m2mGatewayApi.AgreementSeed
  );

  const mockApiAgreement = getMockedApiAgreement();

  const mockM2MAgreementResponse: m2mGatewayApi.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement.data);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.AgreementSeed
  ) =>
    request(api)
      .post(`${appBasePath}/agreements`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.createAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockAgreementSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MAgreementResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockAgreementSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockAgreementSeed, invalidParam: "invalidValue" },
    { ...mockAgreementSeed, eserviceId: undefined },
    { ...mockAgreementSeed, descriptorId: undefined },
  ])(
    "Should return 400 if passed an invalid agreement seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as unknown as m2mGatewayApi.AgreementSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    { ...mockM2MAgreementResponse, state: "INVALID_STATE" },
    { ...mockM2MAgreementResponse, invalidParam: "invalidValue" },
    { ...mockM2MAgreementResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAgreementService.createAgreement = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockAgreementSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([missingMetadata(), resourcePollingTimeout(3)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockAgreementService.createAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockAgreementSeed);

      expect(res.status).toBe(500);
    }
  );
});
