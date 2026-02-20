import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorInterfaceNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";

describe("DELETE /eservices/:eserviceId/descriptors/:descriptorId/interface router test", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/interface`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.deleteEServiceDescriptorInterface = vi
        .fn()
        .mockResolvedValue(undefined);
      const token = generateToken(role);
      const res = await makeRequest(token, eserviceId, descriptorId);
      expect(res.status).toBe(204);
      expect(
        mockEserviceService.deleteEServiceDescriptorInterface
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

  it("Should return 400 for incorrect value for eservice id", async () => {
    mockEserviceService.deleteEServiceDescriptorInterface = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID ID", descriptorId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for descriptor id", async () => {
    mockEserviceService.deleteEServiceDescriptorInterface = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, eserviceId, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each([
    eserviceDescriptorNotFound(generateId(), generateId()),
    eserviceDescriptorInterfaceNotFound(generateId(), generateId()),
  ])("Should return 404 in case of $code error", async (error) => {
    mockEserviceService.deleteEServiceDescriptorInterface = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(404);
  });
});
