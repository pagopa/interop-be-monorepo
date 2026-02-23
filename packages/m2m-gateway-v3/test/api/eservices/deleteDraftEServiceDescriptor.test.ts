import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  cannotDeleteLastEServiceDescriptor,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /eservices/:eServiceId/descriptors/:descriptorId router test", () => {
  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s, generateId()",
    async (role) => {
      mockEserviceService.deleteDraftEServiceDescriptor = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), generateId());

      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 400 for invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID_ID", generateId());
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it("Should return 409 in case of cannotDeleteLastEServiceDescriptor error", async () => {
    mockEserviceService.deleteDraftEServiceDescriptor = vi
      .fn()
      .mockRejectedValue(
        cannotDeleteLastEServiceDescriptor(generateId(), generateId())
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(409);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.deleteDraftEServiceDescriptor = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(500);
  });
});
