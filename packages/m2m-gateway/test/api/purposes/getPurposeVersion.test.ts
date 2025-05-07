import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";

describe("GET /purpose/:purposeId/versions/:versionId router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    purposeId: string,
    versionId: string
  ) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}/versions/${versionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockApiPurposeVersion = getMockedApiPurposeVersion();
  const mockApiPurpose = getMockedApiPurpose({
    versions: [mockApiPurposeVersion],
  });

  const mockM2MPurposeVersionResponse: m2mGatewayApi.PurposeVersion =
    mockApiPurposeVersion;

  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurposeVersion = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeVersionResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockM2MPurposeVersionResponse.id,
        mockApiPurposeVersion.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeVersionResponse);
    }
  );

  it("Should return 400 for incorrect value for purpose id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID_VERSION_ID", generateId());
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for purpose version id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      mockApiPurpose.data.id,
      "INVALID_VERSION_ID"
    );
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });
});
