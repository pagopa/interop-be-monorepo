import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockedApiPurpose } from "../../mockUtils.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import {
  purposeNotFound,
  missingActivePurposeVersion,
} from "../../../src/model/errors.js";

describe("GET /purpose/:purposeId router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (token: string, purposeId: string) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockApiPurpose = getMockedApiPurpose();

  const mockM2MPurposesResponse: m2mGatewayApi.Purpose = toM2MGatewayApiPurpose(
    {
      purpose: mockApiPurpose.data,
      logger: genericLogger,
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurposesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockM2MPurposesResponse.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposesResponse);
    }
  );

  it("Should return 400 for incorrect value for purpose id", async () => {
    mockPurposeService.getPurpose = vi
      .fn()
      .mockResolvedValue(mockM2MPurposesResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 404 in case of purposeNotFound error", async () => {
    mockPurposeService.getPurpose = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockApiPurpose.data.id));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockM2MPurposesResponse.id);

    expect(res.status).toBe(404);
  });

  it("Should return 500 in case of missingActivePurposeVersion error", async () => {
    mockPurposeService.getPurpose = vi
      .fn()
      .mockRejectedValue(
        missingActivePurposeVersion(mockM2MPurposesResponse.id)
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockM2MPurposesResponse.id);

    expect(res.status).toBe(500);
  });
});
