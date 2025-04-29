/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
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

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
    expect(res.status).toBe(404);
  });
});
