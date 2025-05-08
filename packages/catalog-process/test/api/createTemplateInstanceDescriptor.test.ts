/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";

import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { descriptorToApiDescriptor } from "../../src/model/domain/apiConverter.js";

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
    version: "1",
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

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .post(`/templates/eservices/${eServiceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(descriptorSeed);

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

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
    expect(res.status).toBe(404);
  });
});
