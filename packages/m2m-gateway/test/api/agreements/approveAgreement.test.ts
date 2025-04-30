/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockedApiAgreement } from "../../mockUtils.js";
import { toM2MAgreement } from "../../../src/api/agreementApiConverter.js";
import {
  agreementNotInPendingState,
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";

describe("POST /agreements/:agreementId/approve router test", () => {
  const mockApiAgreement = getMockedApiAgreement();
  const mockM2MAgreementResponse: m2mGatewayApi.Agreement = toM2MAgreement(
    mockApiAgreement.data
  );

  const makeRequest = async (token: string) =>
    request(api)
      .post(`${appBasePath}/agreements/${mockApiAgreement.data.id}/approve`)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockAgreementService.approveAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MAgreementResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 500 in case of missingMetadata error", async () => {
    mockAgreementService.approveAgreement = vi
      .fn()
      .mockRejectedValue(missingMetadata());
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of resourcePollingTimeout error", async () => {
    mockAgreementService.approveAgreement = vi
      .fn()
      .mockRejectedValue(resourcePollingTimeout(3));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of resourcePollingTimeout error", async () => {
    mockAgreementService.approveAgreement = vi
      .fn()
      .mockRejectedValue(agreementNotInPendingState(mockApiAgreement.data.id));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(400);
  });
});
