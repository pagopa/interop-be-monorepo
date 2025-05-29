/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";

import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import { descriptorToApiDescriptor } from "../../src/model/domain/apiConverter.js";
import {
  draftDescriptorAlreadyExists,
  eServiceNotFound,
  eserviceWithoutValidDescriptors,
  inconsistentDailyCalls,
} from "../../src/model/domain/errors.js";

describe("API /templates/eservices/{eServiceId}/descriptors authorization test", () => {
  const templateVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    state: eserviceTemplateVersionState.published,
    interface: getMockDocument(),
  };

  const template: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [templateVersion],
  };

  const mockDescriptor: Descriptor = {
    ...getMockDescriptor(),
    version: 1,
    state: descriptorState.published,
    interface: getMockDocument(),
    templateVersionRef: {
      id: templateVersion.id,
    },
  };

  const descriptorSeed: catalogApi.EServiceInstanceDescriptorSeed = {
    audience: [],
    dailyCallsPerConsumer: 60,
    dailyCallsTotal: 60,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [],
    templateId: template.id,
  };

  const apiDescriptor = catalogApi.EServiceDescriptor.parse(
    descriptorToApiDescriptor(mockDescriptor)
  );

  catalogService.createTemplateInstanceDescriptor = vi
    .fn()
    .mockResolvedValue(mockDescriptor);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServiceInstanceDescriptorSeed = descriptorSeed
  ) =>
    request(api)
      .post(`/templates/eservices/${eServiceId}/descriptors`)
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
      expect(res.body).toEqual(apiDescriptor);
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
    {
      error: draftDescriptorAlreadyExists(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.createTemplateInstanceDescriptor = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id],
    [{ ...descriptorSeed, dailyCallsPerConsumer: "invalid" }, mockEService.id],
    [{ ...descriptorSeed, audience: "notAnArray" }, mockEService.id],
    [{ ...descriptorSeed, dailyCallsTotal: -10 }, mockEService.id],
    [{ ...descriptorSeed, audience: undefined }, mockEService.id],
    [{ ...descriptorSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid instance descriptor params: %s (eServiceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServiceInstanceDescriptorSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
