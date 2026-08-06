/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  delegatedArchivingRequestNotActive,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  gracePeriodDaysLowerThanDescriptor,
  noActiveDelegationFound,
  noDelegatedArchivingRequestFound,
  notValidEServiceState,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /eservices/:eServiceId/approveDelegatedArchiving authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const mockApiEservice = eServiceToApiEService(mockEService);

  const mockEserviceWithMetadata = getMockWithMetadata(mockEService);

  catalogService.approveDelegatedEServiceArchiving = vi
    .fn()
    .mockResolvedValue(mockEserviceWithMetadata);

  const makeRequest = async (token: string, eServiceId: EServiceId) =>
    request(api)
      .post(`/eservices/${eServiceId}/approveDelegatedArchiving`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
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
      error: noDelegatedArchivingRequestFound(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: delegatedArchivingRequestNotActive(mockEService.id),
      expectedStatus: 409,
    },
    {
      error: notValidEServiceState(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: noActiveDelegationFound(mockEService.id),
      expectedStatus: 409,
    },
    {
      error: gracePeriodDaysLowerThanDescriptor(
        mockEService.id,
        descriptor.id,
        new Date("2026-01-30T10:00:00.000Z"), //Requested archiving
        new Date("2026-01-29T10:00:00.000Z") //Scheduled descriptor archiving (lower)
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.approveDelegatedEServiceArchiving = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each(["invalidId"])(
    "Should return 400 if passed invalid params: (eserviceId: %s)",
    async (eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId as EServiceId);

      expect(res.status).toBe(400);
    }
  );
});
