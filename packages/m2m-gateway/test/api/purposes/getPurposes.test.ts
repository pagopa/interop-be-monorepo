import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import { getMockedApiPurpose } from "../../mockUtils.js";

describe("GET /purposes router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetPurposesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();

  const mockM2MPurposesResponse: m2mGatewayApi.Purposes = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiPurpose(mockApiPurpose1.data),
      toM2MGatewayApiPurpose(mockApiPurpose2.data),
    ],
  };

  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurposes = vi
        .fn()
        .mockResolvedValue(mockM2MPurposesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, {
        offset: 0,
        limit: 10,
        eserviceIds: [],
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposesResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, {
      offset: 0,
      limit: 10,
      eserviceIds: [],
    });
    expect(res.status).toBe(403);
  });
});
