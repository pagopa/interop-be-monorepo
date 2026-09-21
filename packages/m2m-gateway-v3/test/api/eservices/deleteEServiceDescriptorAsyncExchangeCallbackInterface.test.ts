import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { api, mockEserviceService } from "../../vitest.api.setup.js";

describe("DELETE /eservices/:eserviceId/descriptors/:descriptorId/asyncExchangeCallbackInterface router test", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/asyncExchangeCallbackInterface`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.deleteEServiceDescriptorAsyncExchangeCallbackInterface =
        vi.fn().mockResolvedValue(undefined);
      const token = generateToken(role);
      const res = await makeRequest(token, eserviceId, descriptorId);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(
        mockEserviceService.deleteEServiceDescriptorAsyncExchangeCallbackInterface
      ).toHaveBeenCalledWith(eserviceId, descriptorId, expect.any(Object));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eserviceId, descriptorId);
    expect(res.status).toBe(403);
  });

  it.each([
    eserviceDescriptorNotFound(generateId(), generateId()),
    eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound(
      generateId(),
      generateId()
    ),
  ])("Should return 404 in case of $code error", async (error) => {
    mockEserviceService.deleteEServiceDescriptorAsyncExchangeCallbackInterface =
      vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(404);
  });
});
