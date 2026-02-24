import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { purposeVersionNotFound } from "../../../src/model/errors.js";
import { toM2mGatewayApiPurposeVersion } from "../../../src/api/purposeApiConverter.js";

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

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurposeVersion = vi
        .fn()
        .mockResolvedValue(
          toM2mGatewayApiPurposeVersion(mockApiPurposeVersion)
        );

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockApiPurposeVersion.id,
        mockApiPurposeVersion.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiPurposeVersion);
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
      mockApiPurpose.id,
      "INVALID_VERSION_ID"
    );
    expect(res.status).toBe(400);
  });

  it("Should return 404 for purposeVersionNotFound", async () => {
    mockPurposeService.getPurposeVersion = vi
      .fn()
      .mockRejectedValue(
        purposeVersionNotFound(
          unsafeBrandId(mockApiPurpose.id),
          unsafeBrandId(mockApiPurposeVersion.id)
        )
      );

    const token = generateToken(authRole.M2M_ROLE);

    const res = await makeRequest(token, mockApiPurpose.id, generateId());
    expect(res.status).toBe(404);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockApiPurposeVersion, createdAt: undefined },
    { ...mockApiPurposeVersion, state: "invalidState" },
    { ...mockApiPurposeVersion, extraParam: "extraValue" },
    { extraParam: true },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.getPurposeVersion = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockApiPurposeVersion.id,
        mockApiPurposeVersion.id
      );

      expect(res.status).toBe(500);
    }
  );
});
