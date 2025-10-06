/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  descriptorState,
  EService,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockEService,
} from "pagopa-interop-commons-test";

import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  documentPrettyNameDuplicate,
  eServiceNameDuplicateForProducer,
  eServiceTemplateNotFound,
  eServiceTemplateWithoutPersonalDataFlag,
  eServiceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
  interfaceAlreadyExists,
  notValidDescriptorState,
  originNotCompliant,
  templateMissingRequiredRiskAnalysis,
  tenantKindNotFound,
  tenantNotFound,
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

  const makeRequest = async (token: string, templateId: EServiceTemplateId) =>
    request(api)
      .post(`/templates/${templateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

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

  it.each([
    {
      error: interfaceAlreadyExists(generateId()),
      expectedStatus: 409,
    },
    {
      error: documentPrettyNameDuplicate("test", generateId()),
      expectedStatus: 409,
    },
    {
      error: eServiceNameDuplicateForProducer(
        eService.name,
        eService.producerId
      ),
      expectedStatus: 409,
    },
    {
      error: eServiceTemplateNotFound(eServiceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: originNotCompliant("IPA"),
      expectedStatus: 403,
    },
    {
      error: notValidDescriptorState(generateId(), descriptorState.draft),
      expectedStatus: 400,
    },
    {
      error: inconsistentDailyCalls(),
      expectedStatus: 400,
    },
    {
      error: eServiceTemplateWithoutPublishedVersion(eServiceTemplate.id),
      expectedStatus: 400,
    },
    {
      error: tenantNotFound(generateId()),
      expectedStatus: 500,
    },
    {
      error: tenantKindNotFound(generateId()),
      expectedStatus: 500,
    },
    {
      error: templateMissingRequiredRiskAnalysis(
        eServiceTemplate.id,
        generateId(),
        tenantKind.PA
      ),
      expectedStatus: 400,
    },
    {
      error: eServiceTemplateWithoutPersonalDataFlag(
        eServiceTemplate.id,
        publishedVersion.id
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.createEServiceInstanceFromTemplate = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceTemplate.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { eServiceTemplateId: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceTemplateId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId as EServiceTemplateId
      );

      expect(res.status).toBe(400);
    }
  );
});
