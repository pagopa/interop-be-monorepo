/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  EService,
  EServiceTemplate,
  EServiceTemplateId,
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
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { eServiceTemplateNotFound } from "../../src/model/domain/errors.js";

describe("API /templates/{templateId}/eservices authorization test", () => {
  const mockEService = getMockEService();

  const publishedVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    state: eserviceTemplateVersionState.published,
  };

  const eServiceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [publishedVersion],
  };

  const eService: EService = {
    ...mockEService,
    description: eServiceTemplate.description,
    name: eServiceTemplate.name,
    isConsumerDelegable: false,
    isClientAccessDelegable: false,
    templateRef: {
      id: eServiceTemplate.id,
      instanceLabel: mockEService?.templateRef?.instanceLabel,
    },
  };

  const mockApiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(eService)
  );

  vi.spyOn(
    catalogService,
    "createEServiceInstanceFromTemplate"
  ).mockResolvedValue(eService);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, templateId: EServiceTemplateId) =>
    request(api)
      .post(`/templates/${templateId}/eservices`) // Fix del path
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        instanceLabel: "Test Instance",
        isSignalHubEnabled: true,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      });

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, eServiceTemplate.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiEservice);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, eServiceTemplate.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for eServiceTemplateNotFound", async () => {
    vi.spyOn(
      catalogService,
      "createEServiceInstanceFromTemplate"
    ).mockRejectedValue(eServiceTemplateNotFound(eServiceTemplate.id));

    const res = await makeRequest(
      generateToken(getMockAuthData()),
      generateId()
    );

    expect(res.status).toBe(404);
  });
});
