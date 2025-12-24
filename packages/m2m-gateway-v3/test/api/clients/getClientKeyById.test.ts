import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockClientJWKKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MJWK } from "../../../src/api/keysApiConverter.js";

describe("GET /clients/:clientId/keys/:keyId router test", () => {
  const makeRequest = async (token: string, clientId: string, keyId: string) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const kid = generateId();
  const mockApiKey1 = { ...getMockClientJWKKey(), kid };

  const mockM2MJWKResponse: m2mGatewayApiV3.JWK = toM2MJWK(mockApiKey1);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      const clientId = generateId();
      mockClientService.getClientKeyById = vi
        .fn()
        .mockResolvedValue(mockM2MJWKResponse);
      const token = generateToken(role);
      const res = await makeRequest(token, clientId, kid);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MJWKResponse);
      expect(mockClientService.getClientKeyById).toHaveBeenCalledWith(
        clientId,
        kid,
        expect.any(Object) // context
      );
    }
  );
});
