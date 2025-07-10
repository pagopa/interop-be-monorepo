/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Client,
  ClientId,
  clientKind,
  Descriptor,
  descriptorState,
  generateId,
  Purpose,
  PurposeId,
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
  getMockWithMetadata,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientKindNotAllowed,
  clientNotFound,
  eserviceNotDelegableForClientAccess,
  noActiveOrSuspendedAgreementFound,
  noActiveOrSuspendedPurposeVersionFound,
  tenantNotAllowedOnClient,
  tenantNotAllowedOnPurpose,
  purposeAlreadyLinkedToClient,
  purposeDelegationNotFound,
  purposeNotFound,
} from "../../src/model/domain/errors.js";
import { testToFullClient } from "../apiUtils.js";

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

  const mockClient: Client = getMockClient({
    kind: clientKind.consumer,
    consumerId: mockTokenOrganizationId,
  });
  const serviceResponse = getMockWithMetadata(mockClient);
  authorizationService.addClientPurpose = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    purposeId: PurposeId = mockPurpose.id
  ) =>
    request(api)
      .post(`/clients/${clientId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ purposeId });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToFullClient(mockClient));
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
      expect(authorizationService.addClientPurpose).toHaveBeenCalledWith(
        {
          clientId: mockClient.id,
          seed: {
            purposeId: mockPurpose.id,
          },
        },
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
    {
      error: purposeNotFound(mockPurpose.id),
      expectedStatus: 404,
    },
    {
      error: noActiveOrSuspendedAgreementFound(mockEservice.id, mockConsumerId),
      expectedStatus: 400,
    },
    {
      error: noActiveOrSuspendedPurposeVersionFound(mockPurpose.id),
      expectedStatus: 400,
    },
    {
      error: eserviceNotDelegableForClientAccess(mockEservice),
      expectedStatus: 400,
    },
    {
      error: purposeAlreadyLinkedToClient(mockPurpose.id, mockClient.id),
      expectedStatus: 409,
    },
    {
      error: clientKindNotAllowed(mockClient.id),
      expectedStatus: 403,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
    },
    {
      error: tenantNotAllowedOnPurpose(generateId(), mockPurpose.id),
      expectedStatus: 403,
    },
    {
      error: purposeDelegationNotFound(generateId()),
      expectedStatus: 500,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.addClientPurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { clientId: "invalidId", purposeId: mockPurpose.id },
    { clientId: mockClient.id, purposeId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId, purposeId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        purposeId as PurposeId
      );

      expect(res.status).toBe(400);
    }
  );
});
