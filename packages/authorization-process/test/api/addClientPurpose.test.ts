/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Client,
  Descriptor,
  descriptorState,
  generateId,
  Purpose,
  purposeVersionState,
  TenantId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";

describe("API /clients/{clientId}/purposes authorization test", () => {
  const mockDescriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    interface: getMockDocument(),
    publishedAt: new Date(),
  };

  const mockEservice = {
    ...getMockEService(),
    descriptors: [mockDescriptor],
  };
  const mockConsumerId: TenantId = generateId();

  const mockPurpose: Purpose = {
    ...getMockPurpose(),
    eserviceId: mockEservice.id,
    consumerId: mockConsumerId,
    versions: [getMockPurposeVersion(purposeVersionState.active)],
  };

  const mockClient: Client = {
    ...getMockClient(),
    consumerId: mockConsumerId,
  };

  authorizationService.addClientPurpose = vi.fn().mockResolvedValue({});

  const makeRequest = async (token: string, clientId: string) =>
    request(api)
      .post(`/clients/${clientId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ purposeId: mockPurpose.id });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
    expect(res.status).toBe(404);
  });
});
