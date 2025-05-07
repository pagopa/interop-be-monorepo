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
import {
  clientKindNotAllowed,
  clientNotFound,
  eserviceNotDelegableForClientAccess,
  noAgreementFoundInRequiredState,
  noPurposeVersionsFoundInRequiredState,
  organizationNotAllowedOnClient,
  organizationNotAllowedOnPurpose,
  purposeAlreadyLinkedToClient,
  purposeDelegationNotFound,
  purposeNotFound,
} from "../../src/model/domain/errors.js";

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

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(clientNotFound(mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for purposeNotFound", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for noAgreementFoundInRequiredState", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(
        noAgreementFoundInRequiredState(mockEservice.id, mockConsumerId)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for noPurposeVersionsFoundInRequiredState", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(noPurposeVersionsFoundInRequiredState(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for eserviceNotDelegableForClientAccess", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(eserviceNotDelegableForClientAccess(mockEservice));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });

  it("Should return 409 for purposeAlreadyLinkedToClient", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(
        purposeAlreadyLinkedToClient(mockPurpose.id, mockClient.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(409);
  });

  it("Should return 403 for clientKindNotAllowed", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(clientKindNotAllowed(mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationNotAllowedOnClient", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnClient(generateId(), mockClient.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationNotAllowedOnPurpose", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnPurpose(generateId(), mockPurpose.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it("Should return 500 for purposeDelegationNotFound", async () => {
    authorizationService.addClientPurpose = vi
      .fn()
      .mockRejectedValue(purposeDelegationNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(500);
  });
});
