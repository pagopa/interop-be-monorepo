import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  purposeVersionNotFound,
} from "../../../src/model/errors.js";
import { toM2mGatewayApiPurposeVersion } from "../../../src/api/purposeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /purposes/:purposeId/versions router test", () => {
  const mockPurposeVersion = getMockedApiPurposeVersion();
  const mockPurpose = getMockedApiPurpose({
    versions: [mockPurposeVersion],
  });

  const mockPurposeVersionSeed: m2mGatewayApiV3.PurposeVersionSeed = {
    dailyCalls: mockPurposeVersion.dailyCalls,
  };

  const makeRequest = async (
    token: string,
    purposeId: string,
    body: m2mGatewayApiV3.PurposeVersionSeed
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.createPurposeVersion = vi
        .fn()
        .mockResolvedValue(toM2mGatewayApiPurposeVersion(mockPurposeVersion));

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockPurpose.id,
        mockPurposeVersionSeed
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockPurposeVersion);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockPurpose.id,
      mockPurposeVersionSeed
    );
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockPurposeVersionSeed, extraParam: 0 },
    { dailyCalls: -100 },
  ])(
    "Should return 400 if passed invalid purpose version seed",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockPurpose.id,
        body as unknown as m2mGatewayApiV3.PurposeSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    missingMetadata(),
    purposeVersionNotFound(
      unsafeBrandId(mockPurpose.id),
      mockPurposeVersion.id
    ),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeService.createPurposeVersion = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurpose.id,
      mockPurposeVersionSeed
    );

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockPurposeVersion, createdAt: undefined },
    { ...mockPurposeVersion, state: "invalidState" },
    { ...mockPurposeVersion, extraParam: "extraValue" },
    { extraParam: true },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.createPurposeVersion = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockPurpose.id,
        mockPurposeVersionSeed
      );

      expect(res.status).toBe(500);
    }
  );
});
