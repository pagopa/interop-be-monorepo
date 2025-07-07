import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("GET /eservices/:eserviceId router test", () => {
  const mockApiEservice = getMockedApiEservice();
  const mockM2MEserviceResponse: m2mGatewayApi.EService =
    toM2MGatewayApiEService(mockApiEservice);

  const makeRequest = async (token: string, eserviceId: string) =>
    request(api)
      .get(`${appBasePath}/eservices/${eserviceId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.getEService = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiEservice.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiEservice.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId");

    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MEserviceResponse, id: undefined },
    { ...mockM2MEserviceResponse, invalidParam: "invalidValue" },
    { ...mockM2MEserviceResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEService = vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiEservice.id);

      expect(res.status).toBe(500);
    }
  );
});
