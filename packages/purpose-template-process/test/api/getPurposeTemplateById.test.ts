/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { PurposeTemplateId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { purposeTemplateToApiPurposeTemplate } from "../../src/model/domain/apiConverter.js";
import {
  purposeTemplateNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API GET /purposeTemplates/{id}", () => {
  const purposeTemplate = getMockPurposeTemplate();

  const serviceResponse = getMockWithMetadata(purposeTemplate);
  const apiResponse = purposeTemplateApi.PurposeTemplate.parse(
    purposeTemplateToApiPurposeTemplate(purposeTemplate)
  );

  beforeEach(() => {
    purposeTemplateService.getPurposeTemplateById = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = purposeTemplate.id
  ) =>
    request(api)
      .get(`/purposeTemplates/${purposeTemplateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
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
    { error: purposeTemplateNotFound(purposeTemplate.id), expectedStatus: 404 },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.getPurposeTemplateById = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
