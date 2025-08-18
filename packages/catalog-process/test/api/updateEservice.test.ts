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
  randomArrayItem,
  getMockDescriptor,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNameDuplicateForProducer,
  eServiceNotFound,
  eserviceNotInDraftState,
  eserviceTemplateNameConflict,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("PUT /eservices/{eServiceId} router test", () => {
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

  const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
  const isConsumerDelegable = randomArrayItem([false, true, undefined]);
  const isClientAccessDelegable = match(isConsumerDelegable)
    .with(undefined, () => undefined)
    .with(true, () => randomArrayItem([false, true, undefined]))
    .with(false, () => false)
    .exhaustive();

  const eserviceSeed: catalogApi.UpdateEServiceSeed = {
    name: "new Name",
    description: mockEService.description,
    technology: "REST",
    mode: "DELIVER",
    isSignalHubEnabled,
    isConsumerDelegable,
    isClientAccessDelegable,
  };

  catalogService.updateEService = vi.fn().mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eServiceId: string,
    body: catalogApi.UpdateEServiceSeed = eserviceSeed
  ) =>
    request(api)
      .put(`/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
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
      catalogService.updateEService = vi.fn().mockRejectedValueOnce(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id],
    [{ name: 123 }, mockEService.id],
    [{ description: null }, mockEService.id],
    [{ technology: "invalidTechnology" }, mockEService.id],
    [{ mode: "invalidMode" }, mockEService.id],
    [{ isSignalHubEnabled: undefined }, mockEService.id],
    [{ isConsumerDelegable: "stringInsteadOfBool" }, mockEService.id],
    [{ ...eserviceSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or e-service id (seed #%#)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.UpdateEServiceSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
