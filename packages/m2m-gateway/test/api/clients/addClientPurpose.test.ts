import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";

describe("POST /clients/:clientId/purposes router test", () => {
  const mockSeed: m2mGatewayApi.ClientAddPurpose = {
    purposeId: generateId(),
  };
  const makeRequest = async (
    token: string,
    clientId: string,
    body: m2mGatewayApi.ClientAddPurpose
  ) =>
    request(api)
      .post(`${appBasePath}/clients/${clientId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockClientService.addClientPurpose = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), mockSeed);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockSeed);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid client id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid-client-id", mockSeed);

    expect(res.status).toBe(400);
  });

  it.each([
    {},
    { ...mockSeed, purposeId: undefined },
    { ...mockSeed, purposeId: "invalid-purpose-id" },
  ])("Should return 400 if passed an invalid seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      body as m2mGatewayApi.ClientAddPurpose
    );

    expect(res.status).toBe(400);
  });

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockClientService.addClientPurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockSeed);

      expect(res.status).toBe(500);
    }
  );
});
