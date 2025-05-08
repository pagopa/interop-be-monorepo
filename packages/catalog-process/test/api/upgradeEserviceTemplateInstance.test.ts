/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceTemplate,
  EServiceTemplateVersion,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { descriptorToApiDescriptor } from "../../src/model/domain/apiConverter.js";

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
    version: "1",
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

  const makeRequest = async (token: string, eServiceId: string) =>
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

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
    expect(res.status).toBe(404);
  });
});
