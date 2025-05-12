import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";

describe("POST /purposes/:purposeId/versions router test", () => {
  const getMockPurposeVersion = getMockedApiPurposeVersion();
  const mockPurpose = getMockedApiPurpose({
    versions: [getMockPurposeVersion],
  });

  const mockPurposeVersionSeed: m2mGatewayApi.PurposeVersionSeed = {
    dailyCalls: getMockPurposeVersion.dailyCalls,
  };

  const makeRequest = async (
    token: string,
    purposeId: string,
    body: m2mGatewayApi.PurposeVersionSeed
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.createPurposeVersion = vi
        .fn()
        .mockResolvedValue(getMockPurposeVersion);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockPurpose.data.id,
        mockPurposeVersionSeed
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(getMockPurposeVersion);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockPurpose.data.id,
      mockPurposeVersionSeed
    );
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockPurposeVersionSeed, extraParam: 0 },
    { dailyCalls: -100 },
  ])("Should return 400 if passed invalid delegation seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurpose.data.id,
      body as unknown as m2mGatewayApi.PurposeSeed
    );

    expect(res.status).toBe(400);
  });

  it("Should return 500 in case of missingMetadata error", async () => {
    mockPurposeService.createPurposeVersion = vi
      .fn()
      .mockRejectedValue(missingMetadata());
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurpose.data.id,
      mockPurposeVersionSeed
    );

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of resourcePollingTimeout error", async () => {
    mockPurposeService.createPurposeVersion = vi
      .fn()
      .mockRejectedValue(resourcePollingTimeout(3));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurpose.data.id,
      mockPurposeVersionSeed
    );

    expect(res.status).toBe(500);
  });
});
