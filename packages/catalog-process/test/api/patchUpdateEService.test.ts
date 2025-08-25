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
  eServiceNameDuplicateForProducer,
  eServiceNotFound,
  eserviceNotInDraftState,
  eserviceTemplateNameConflict,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("PATCH /eservices/{eServiceId} router test", () => {
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

  const eserviceSeed: catalogApi.PatchUpdateEServiceSeed = {
    name: "new Name",
    description: mockEService.description,
    technology: "REST",
    mode: "DELIVER",
    isSignalHubEnabled: true,
    isConsumerDelegable: true,
    isClientAccessDelegable: true,
  };

  catalogService.patchUpdateEService = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eServiceId: string,
    body: catalogApi.PatchUpdateEServiceSeed = eserviceSeed
  ) =>
    request(api)
      .patch(`/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each([
    {},
    { name: "updated name" },
    {
      name: "updated name",
      description: "updated description",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
      mode: "RECEIVE",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: false,
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "SOAP",
      mode: "RECEIVE",
      isSignalHubEnabled: false,
      isConsumerDelegable: false,
    },
  ] as catalogApi.PatchUpdateEServiceSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, seed);
      expect(res.status).toBe(200);
    }
  );

  it.each([
    [{ name: 123 }, mockEService.id],
    [{ description: null }, mockEService.id],
    [{ technology: "invalidTechnology" }, mockEService.id],
    [{ mode: "invalidMode" }, mockEService.id],
    [{ isConsumerDelegable: "stringInsteadOfBool" }, mockEService.id],
    [{ ...eserviceSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or e-service id (seed #%#)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.UpdateEServiceSeed
      );

      expect(res.status).toBe(400);
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
      error: eServiceNameDuplicateForProducer(
        mockEService.name,
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
      error: eserviceNotInDraftState(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: templateInstanceNotAllowed(
        mockEService.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        mockEService.templateId!
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.patchUpdateEService = vi.fn().mockRejectedValueOnce(error);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );
});
