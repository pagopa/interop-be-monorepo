/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  generateId,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";

import { catalogApi } from "pagopa-interop-api-clients";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
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
    templateRef: {
      id: template.id,
    },
  };

  const mockApiDescriptor = catalogApi.EServiceDescriptor.parse(
    descriptorToApiDescriptor(mockDescriptor)
  );

  vi.spyOn(
    catalogService,
    "createTemplateInstanceDescriptor"
  ).mockResolvedValue(mockDescriptor);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, eServiceId: EServiceId) =>
    request(api)
      .post(`/templates/eservices/${eServiceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(descriptorSeed);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiDescriptor);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(
      generateToken(getMockAuthData()),
      "" as EServiceId
    );
    expect(res.status).toBe(404);
  });
});
