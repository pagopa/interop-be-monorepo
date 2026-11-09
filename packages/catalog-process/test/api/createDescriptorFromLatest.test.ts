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
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  asyncExchangeBulkNotAllowedForSoap,
  draftDescriptorAlreadyExists,
  eServiceNotFound,
  eserviceInArchivingOrArchivedState,
  eserviceWithoutValidDescriptors,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /eservices/{eServiceId}/descriptors/fromLatest authorization test", () => {
  const newDescriptor: Descriptor = {
    ...getMockDescriptor(),
    version: "2",
    docs: [],
  };

  const eservice: EService = {
    ...getMockEService(),
    descriptors: [newDescriptor],
  };

  const serviceResponse = getMockWithMetadata({
    eservice,
    createdDescriptorId: newDescriptor.id,
  });

  const apiCreatedDescriptor = catalogApi.CreatedEServiceDescriptor.parse({
    eservice: eServiceToApiEService(eservice),
    createdDescriptorId: newDescriptor.id,
  });

  catalogService.createDescriptorFromLatest = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (token: string, eServiceId: EServiceId) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/fromLatest`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id);
      expect(res.body).toEqual(apiCreatedDescriptor);
      expect(res.status).toBe(200);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNotFound(eservice.id),
      expectedStatus: 404,
    },
    {
      error: eserviceWithoutValidDescriptors(eservice.id),
      expectedStatus: 409,
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      error: templateInstanceNotAllowed(eservice.id, eservice.templateId!),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: draftDescriptorAlreadyExists(eservice.id),
      expectedStatus: 400,
    },
    {
      error: eserviceInArchivingOrArchivedState(eservice.id),
      expectedStatus: 400,
    },
    {
      error: asyncExchangeBulkNotAllowedForSoap(eservice.id, newDescriptor.id),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.createDescriptorFromLatest = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eservice.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid e-service id", async () => {
    catalogService.createDescriptorFromLatest = vi
      .fn()
      .mockResolvedValue(serviceResponse);

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId" as EServiceId);

    expect(res.status).toBe(400);
    expect(catalogService.createDescriptorFromLatest).not.toHaveBeenCalled();
  });
});
