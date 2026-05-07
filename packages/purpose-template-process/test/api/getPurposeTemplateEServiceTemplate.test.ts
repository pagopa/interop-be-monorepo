/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceTemplateId,
  EServiceTemplateVersionPurposeTemplate,
  generateId,
  PurposeTemplateId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  eServiceTemplateVersionPurposeTemplateNotFound,
  purposeTemplateNotFound,
} from "../../src/model/domain/errors.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateVersionPurposeTemplateToApiEServiceTemplateVersionPurposeTemplate } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposeTemplates/:id/eserviceTemplates/:eserviceTemplateId", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const eserviceTemplateId = generateId<EServiceTemplateId>();
  const eserviceTemplateVersionPurposeTemplate: EServiceTemplateVersionPurposeTemplate =
    {
      purposeTemplateId,
      eserviceTemplateId,
      eserviceTemplateVersionId: generateId(),
      createdAt: new Date(),
    };

  const apiResponse =
    purposeTemplateApi.EServiceTemplateVersionPurposeTemplate.parse(
      eserviceTemplateVersionPurposeTemplateToApiEServiceTemplateVersionPurposeTemplate(
        eserviceTemplateVersionPurposeTemplate
      )
    );

  beforeEach(() => {
    purposeTemplateService.getPurposeTemplateEServiceTemplate = vi
      .fn()
      .mockResolvedValue(eserviceTemplateVersionPurposeTemplate);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    eserviceTemplateId: EServiceTemplateId = generateId()
  ) =>
    request(api)
      .get(
        `/purposeTemplates/${purposeTemplateId}/eserviceTemplates/${eserviceTemplateId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: eServiceTemplateVersionPurposeTemplateNotFound(
        generateId(),
        generateId()
      ),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.getPurposeTemplateEServiceTemplate = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid" as PurposeTemplateId,
      eserviceTemplateId,
    },
    {
      purposeTemplateId,
      eserviceTemplateId: "invalid" as EServiceTemplateId,
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeTemplateId, eserviceTemplateId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        eserviceTemplateId
      );
      expect(res.status).toBe(400);
    }
  );
});
