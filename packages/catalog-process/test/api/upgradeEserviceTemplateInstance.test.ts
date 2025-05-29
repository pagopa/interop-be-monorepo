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
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { descriptorToApiDescriptor } from "../../src/model/domain/apiConverter.js";
import {
  eServiceAlreadyUpgraded,
  eServiceDescriptorNotFound,
  eServiceNotAnInstance,
  eServiceNotFound,
  eServiceTemplateNotFound,
} from "../../src/model/domain/errors.js";

describe("API /templates/eservices/{eServiceId}/upgrade authorization test", () => {
  const firstTemplateVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    version: 1,
    state: descriptorState.deprecated,
    docs: [],
  };

  const secondTemplateVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    version: 2,
    state: descriptorState.published,
    docs: [getMockDocument(), getMockDocument()],
  };

  const template: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [firstTemplateVersion, secondTemplateVersion],
  };

  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    templateVersionRef: { id: firstTemplateVersion.id },
    version: 1,
    state: descriptorState.published,
    interface: undefined,
    docs: [],
  };

  const eservice: EService = {
    ...getMockEService(),
    templateId: template.id,
    descriptors: [descriptor],
  };

  const apiDescriptor = catalogApi.EServiceDescriptor.parse(
    descriptorToApiDescriptor(descriptor)
  );

  catalogService.upgradeEServiceInstance = vi
    .fn()
    .mockResolvedValue(descriptor);

  const makeRequest = async (token: string, eServiceId: EServiceId) =>
    request(api)
      .post(`/templates/eservices/${eServiceId}/upgrade`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDescriptor);
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
      error: eServiceDescriptorNotFound(eservice.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eServiceNotAnInstance(eservice.id),
      expectedStatus: 400,
    },
    {
      error: eServiceAlreadyUpgraded(eservice.id),
      expectedStatus: 400,
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      error: eServiceTemplateNotFound(eservice.templateId!),
      expectedStatus: 500,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.upgradeEServiceInstance = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eservice.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { eserviceId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s (eServiceId: %s, descriptorId: %s)",
    async ({ eserviceId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eserviceId as EServiceId);

      expect(res.status).toBe(400);
    }
  );
});
