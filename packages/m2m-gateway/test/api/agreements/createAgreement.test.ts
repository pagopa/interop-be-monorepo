/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockedApiAgreement } from "../../mockUtils.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";

describe("POST /agreements router test", () => {
  const mockAgreementSeed: m2mGatewayApi.AgreementSeed = {
    eserviceId: generateId(),
    descriptorId: generateId(),
  };

  const mockApiAgreement = getMockedApiAgreement();
  const mockM2MAgreementResponse: m2mGatewayApi.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement.data);

  const makeRequest = async (token: string, body: Record<string, unknown>) =>
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

      expect(res.status).toBe(200);
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

  it("Should return 400 if passed an invalid agreement seed", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, {
      invalidParam: "invalidValue",
    });

    expect(res.status).toBe(400);
  });

  it.each([missingMetadata(), resourcePollingTimeout(3)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockAgreementService.createAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, { id: generateId() });

      expect(res.status).toBe(500);
    }
  );
});
