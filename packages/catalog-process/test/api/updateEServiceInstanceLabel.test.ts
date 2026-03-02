/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { generateToken, getMockEService } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNameDuplicateForProducer,
  eServiceNotAnInstance,
  eServiceNotFound,
  eserviceWithoutValidDescriptors,
} from "../../src/model/domain/errors.js";

describe("POST /templates/eservices/{eServiceId}/instanceLabel/update test", () => {
  const mockEService: EService = getMockEService();

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  catalogService.updateEServiceInstanceLabelAfterPublication = vi
    .fn()
    .mockResolvedValue(mockEService);

  const mockEServiceInstanceLabelUpdateSeed: catalogApi.EServiceInstanceLabelUpdateSeed =
    {
      instanceLabel: "test",
    };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServiceInstanceLabelUpdateSeed = mockEServiceInstanceLabelUpdateSeed
  ) =>
    request(api)
      .post(`/templates/eservices/${eServiceId}/instanceLabel/update`)
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
      error: eServiceNameDuplicateForProducer(
        "duplicated name",
        mockEService.producerId
      ),
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
      error: eServiceNotAnInstance(mockEService.id),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateEServiceInstanceLabelAfterPublication = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [
      { ...mockEServiceInstanceLabelUpdateSeed, extraField: 1 },
      mockEService.id,
    ],
    [{ ...mockEServiceInstanceLabelUpdateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServiceInstanceLabelUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
