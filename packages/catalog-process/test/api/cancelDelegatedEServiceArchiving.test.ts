/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptorArchiving,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import {
  eServiceToApiEService,
  descriptorToApiDescriptor,
} from "../../src/model/domain/apiConverter.js";
import {
  delegatedArchiveRequestForIncorrectDelegateProducer,
  delegatedArchivingRequestNotActive,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  noActiveDelegationFound,
  noDelegatedArchivingRequestFound,
  noDelegationForArchivingRequest,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /eservices/${eServiceId}/submitDelegatedArchiving authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptorArchiving(),
    version: "1",
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiDescriptor = catalogApi.EServiceDescriptor.parse(
    descriptorToApiDescriptor(descriptor)
  );

  const mockApiEservice = eServiceToApiEService(mockEService);
  mockApiEservice.descriptors = [apiDescriptor];

  const mockEserviceWithMetadata = getMockWithMetadata(mockEService);

  catalogService.cancelDelegatedEServiceArchiving = vi
    .fn()
    .mockResolvedValue(mockEserviceWithMetadata);

  const makeRequest = async (token: string, eServiceId: EServiceId) =>
    request(api)
      .delete(`/eservices/${eServiceId}/submitDelegatedArchiving`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiEservice);
      expect(res.headers["x-metadata-version"]).toBe(
        mockEserviceWithMetadata.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(mockEService.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: noDelegationForArchivingRequest(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: delegatedArchivingRequestNotActive(mockEService.id, descriptor.id),
      expectedStatus: 400,
    },
    {
      error: noActiveDelegationFound(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: noDelegatedArchivingRequestFound(mockEService.id, descriptor.id),
      expectedStatus: 400,
    },
    {
      error: delegatedArchiveRequestForIncorrectDelegateProducer(
        mockEService.id,
        descriptor.id
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.cancelDelegatedEServiceArchiving = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { eServiceId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId as EServiceId);

      expect(res.status).toBe(400);
    }
  );
});
