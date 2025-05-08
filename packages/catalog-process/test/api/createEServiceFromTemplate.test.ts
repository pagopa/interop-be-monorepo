/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
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
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { getMockEService } from "../mockUtils.js";
import {
  documentPrettyNameDuplicate,
  eServiceNameDuplicate,
  eServiceTemplateNotFound,
  eServiceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
  interfaceAlreadyExists,
  notValidDescriptorState,
  originNotCompliant,
} from "../../src/model/domain/errors.js";

describe("API /templates/{templateId}/eservices authorization test", () => {
  const publishedVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    state: eserviceTemplateVersionState.published,
  };

  const eServiceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [publishedVersion],
  };

  const eService: EService = {
    ...getMockEService(),
    description: eServiceTemplate.description,
    name: eServiceTemplate.name,
    isConsumerDelegable: false,
    isClientAccessDelegable: false,
    templateId: eServiceTemplate.id,
  };

  const mockApiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(eService)
  );

  catalogService.createEServiceInstanceFromTemplate = vi
    .fn()
    .mockResolvedValue(eService);

  const makeRequest = async (token: string, templateId: string) =>
    request(api)
      .post(`/templates/${templateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(templateId);
  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eServiceTemplate.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiEservice);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eServiceTemplate.id);

    expect(res.status).toBe(403);
  });

  it("Should return 409 for interfaceAlreadyExists", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(interfaceAlreadyExists(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(409);
  });

  it("Should return 409 for documentPrettyNameDuplicate", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(documentPrettyNameDuplicate("test", generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(409);
  });

  it("Should return 409 for eServiceNameDuplicate", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(eServiceNameDuplicate(eService.name));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(409);
  });

  it("Should return 404 for eServiceTemplateNotFound", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(eServiceTemplateNotFound(eServiceTemplate.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for originNotCompliant", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(originNotCompliant("IPA"));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for notValidDescriptor", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(
        notValidDescriptorState(generateId(), descriptorState.draft)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for inconsistentDailyCalls", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(inconsistentDailyCalls());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for eServiceTemplateWithoutPublishedVersion", async () => {
    catalogService.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockRejectedValue(
        eServiceTemplateWithoutPublishedVersion(eServiceTemplate.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eServiceTemplate.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
