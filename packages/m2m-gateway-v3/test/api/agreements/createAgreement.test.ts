/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAgreement,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("POST /agreements router test", () => {
  const mockAgreementSeed: m2mGatewayApiV3.AgreementSeed = {
    eserviceId: generateId(),
    descriptorId: generateId(),
    delegationId: generateId(),
  };

  const mockApiAgreement = getMockedApiAgreement();
  const mockM2MAgreementResponse: m2mGatewayApiV3.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement, generateId());

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.AgreementSeed
  ) =>
    request(api)
      .post(`${appBasePath}/agreements`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
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
    { ...mockAgreementSeed, eserviceId: "invalidId" },
    { ...mockAgreementSeed, descriptorId: undefined },
    { ...mockAgreementSeed, descriptorId: "invalidId" },
    { ...mockAgreementSeed, delegationId: "invalidId" },
  ])(
    "Should return 400 if passed an invalid agreement seed: %s",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as unknown as m2mGatewayApiV3.AgreementSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAgreementService.createAgreement = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockAgreementSeed);

    expect(res.status).toBe(500);
  });

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
});
