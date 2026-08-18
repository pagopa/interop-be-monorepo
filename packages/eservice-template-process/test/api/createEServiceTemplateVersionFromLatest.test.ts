/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import {
  draftEServiceTemplateVersionAlreadyExists,
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
} from "../../src/model/domain/errors.js";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";

describe("API POST /templates/:templateId/versions/fromLatest", () => {
  const newVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    version: 2,
    docs: [],
  };

  const eserviceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [newVersion],
  };

  const serviceResponse = getMockWithMetadata({
    eserviceTemplate,
    createdEServiceTemplateVersionId: newVersion.id,
  });

  const apiCreatedVersion =
    eserviceTemplateApi.CreatedEServiceTemplateVersion.parse({
      eserviceTemplate: eserviceTemplateToApiEServiceTemplate(eserviceTemplate),
      createdEServiceTemplateVersionId: newVersion.id,
    });

  eserviceTemplateService.createEServiceTemplateVersionFromLatest = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eserviceTemplateId: EServiceTemplateId
  ) =>
    request(api)
      .post(`/templates/${eserviceTemplateId}/versions/fromLatest`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eserviceTemplate.id);
      expect(res.body).toEqual(apiCreatedVersion);
      expect(res.status).toBe(200);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it("Should route to createEServiceTemplateVersionFromLatest and not to the templateVersionId route", async () => {
    eserviceTemplateService.createEServiceTemplateVersionFromLatest = vi
      .fn()
      .mockResolvedValue(serviceResponse);
    eserviceTemplateService.updateDraftTemplateVersion = vi.fn();

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eserviceTemplate.id);

    expect(res.status).toBe(200);
    expect(
      eserviceTemplateService.createEServiceTemplateVersionFromLatest
    ).toHaveBeenCalled();
    expect(
      eserviceTemplateService.updateDraftTemplateVersion
    ).not.toHaveBeenCalled();
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eserviceTemplate.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceTemplateNotFound(eserviceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id),
      expectedStatus: 409,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.createEServiceTemplateVersionFromLatest = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eserviceTemplate.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid template id", async () => {
    eserviceTemplateService.createEServiceTemplateVersionFromLatest = vi
      .fn()
      .mockResolvedValue(serviceResponse);

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "111" as EServiceTemplateId);
    expect(res.status).toBe(400);
    expect(
      eserviceTemplateService.createEServiceTemplateVersionFromLatest
    ).not.toHaveBeenCalled();
  });
});
