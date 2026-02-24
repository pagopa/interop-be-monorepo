/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceUpdateSameNameConflict,
  eServiceNameDuplicateForProducer,
  eServiceNotFound,
  eserviceTemplateNameConflict,
  eserviceWithoutValidDescriptors,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/name/update authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.draft,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const serviceResponse = getMockWithMetadata(mockEService);
  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  catalogService.updateEServiceName = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const mockEServiceNameUpdateSeed: catalogApi.EServiceNameUpdateSeed = {
    name: "New Name",
  };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServiceNameUpdateSeed = mockEServiceNameUpdateSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/name/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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
      expect(res.body).toEqual(apiEservice);
      expect(res.headers["x-metadata-version"]).toEqual(
        serviceResponse.metadata.version.toString()
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
      error: eserviceWithoutValidDescriptors(mockEService.id),
      expectedStatus: 409,
    },
    {
      error: eServiceNameDuplicateForProducer(
        mockEService.id,
        mockEService.producerId
      ),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNameConflict(mockEService.id),
      expectedStatus: 409,
    },
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: templateInstanceNotAllowed(
        mockEService.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        mockEService.templateId!
      ),
      expectedStatus: 403,
    },
    {
      error: eServiceUpdateSameNameConflict(mockEService.id),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateEServiceName = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id],
    [{ name: 123 }, mockEService.id],
    [{ ...mockEServiceNameUpdateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServiceNameUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
