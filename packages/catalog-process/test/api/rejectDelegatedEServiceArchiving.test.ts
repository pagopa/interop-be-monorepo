/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
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
  delegatedArchiveRequestForIncorrectDelegateProducer,
  delegatedArchivingRequestNotActive,
  eServiceNotFound,
  noActiveDelegationFound,
  noDelegatedArchivingRequestFound,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /eservices/:eServiceId/rejectDelegatedArchiving authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const mockEserviceWithMetadata = getMockWithMetadata(mockEService);

  const mockApiEservice = eServiceToApiEService(mockEService);

  const mockRejectReasonSeed: catalogApi.RejectDelegatedEServiceArchivingSeed =
    {
      rejectionReason: "Rejection reason",
    };

  catalogService.rejectDelegatedEServiceArchiving = vi
    .fn()
    .mockResolvedValue(mockEserviceWithMetadata);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.RejectDelegatedEServiceArchivingSeed = mockRejectReasonSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/rejectDelegatedArchiving`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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
      error: noActiveDelegationFound(mockEService.id),
      expectedStatus: 409,
    },
    {
      error: delegatedArchiveRequestForIncorrectDelegateProducer(
        mockEService.id
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.rejectDelegatedEServiceArchiving = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id],
    [{ rejectionReason: "" }, mockEService.id],
    [{ ...mockRejectReasonSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.RejectDelegatedEServiceArchivingSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
