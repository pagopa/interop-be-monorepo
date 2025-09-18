/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("API /templates/eservices/{eServiceId}/descriptors/{descriptorId}/update authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const descriptorQuotasSeed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
    {
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
      dailyCallsTotal: descriptor.dailyCallsTotal + 10,
    };

  catalogService.updateTemplateInstanceDescriptor = vi
    .fn()
    .mockResolvedValue(mockEService);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed = descriptorQuotasSeed
  ) =>
    request(api)
      .post(
        `/templates/eservices/${eServiceId}/descriptors/${descriptorId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateTemplateInstanceDescriptor = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id],
    [{ dailyCallsPerConsumer: "notANumber" }, mockEService.id, descriptor.id],
    [{ dailyCallsTotal: -10 }, mockEService.id, descriptor.id],
    [{ dailyCallsPerConsumer: null }, mockEService.id, descriptor.id],
    [{ ...descriptorQuotasSeed }, "invalidId", descriptor.id],
    [{ ...descriptorQuotasSeed }, mockEService.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid template descriptor quotas seed: %s (eServiceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
