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
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNotFound,
  eserviceWithoutValidDescriptors,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/personalDataFlag authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const serviceResponse = mockEService;
  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const personalData = randomArrayItem([false, true]);

  const eserviceSeed: catalogApi.EServicePersonalDataFlagUpdateSeed = {
    personalData,
  };

  catalogService.updateEServicePersonalDataFlagAfterPublication = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServicePersonalDataFlagUpdateSeed = eserviceSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/personalDataFlag`)
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
      error: eserviceWithoutValidDescriptors(mockEService.id),
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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateEServicePersonalDataFlagAfterPublication = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id],
    [{ personalData: "notABool" }, mockEService.id],
    [{ ...eserviceSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid personalData update params: %s (eServiceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServicePersonalDataFlagUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
