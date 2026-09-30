/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  randomArrayItem,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  operationForbidden,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import {
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
  eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce,
} from "../../src/model/domain/errors.js";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";

describe("API /templates/{templateId}/personalDataFlag", () => {
  const eserviceTemplateVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    state: eserviceTemplateVersionState.published,
    interface: getMockDocument(),
  };

  const mockEServiceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [eserviceTemplateVersion],
  };

  const serviceResponse = mockEServiceTemplate;
  const apiEserviceTemplate = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(mockEServiceTemplate)
  );

  const personalData = randomArrayItem([false, true]);

  const eserviceTemplateSeed: eserviceTemplateApi.EServiceTemplatePersonalDataFlagUpdateSeed =
    { personalData };

  eserviceTemplateService.updateEServiceTemplatePersonalDataFlagAfterPublication =
    vi.fn().mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId,
    body: eserviceTemplateApi.EServiceTemplatePersonalDataFlagUpdateSeed = eserviceTemplateSeed
  ) =>
    request(api)
      .post(`/templates/${templateId}/personalDataFlag`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEServiceTemplate.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEserviceTemplate);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEServiceTemplate.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceTemplateWithoutPublishedVersion(mockEServiceTemplate.id),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce(
        mockEServiceTemplate.id
      ),
      expectedStatus: 409,
    },
    {
      error: eserviceTemplateNotFound(mockEServiceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateEServiceTemplatePersonalDataFlagAfterPublication =
        vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEServiceTemplate.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEServiceTemplate.id],
    [{ personalData: "notABool" }, mockEServiceTemplate.id],
    [{ ...eserviceTemplateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid personalData update params: %s (templateId: %s)",
    async (body, templateId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId as EServiceTemplateId,
        body as eserviceTemplateApi.EServiceTemplatePersonalDataFlagUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
