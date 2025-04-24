/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateVersionToApiEServiceTemplateVersion } from "../../src/model/domain/apiConverter.js";
import {
  draftEServiceTemplateVersionAlreadyExists,
  eServiceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/versions", () => {
  const eserviceTemplateId = generateId<EServiceTemplateId>();
  const mockEserviceTemplateVersion = getMockEServiceTemplateVersion();

  const makeRequest = async (token: string, id: string = eserviceTemplateId) =>
    request(api)
      .post(`/templates/${id}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    eserviceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplateVersion);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(
        eserviceTemplateVersionToApiEServiceTemplateVersion(
          mockEserviceTemplateVersion
        )
      );
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 if eServiceTemplateNotFound", async () => {
    const notFoundEserviceTemplateId = generateId<EServiceTemplateId>();
    eserviceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(eServiceTemplateNotFound(notFoundEserviceTemplateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${notFoundEserviceTemplateId} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 400 if draftEServiceTemplateVersionAlreadyExists", async () => {
    eserviceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(
        draftEServiceTemplateVersionAlreadyExists(eserviceTemplateId)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `Draft version for EService Template ${eserviceTemplateId} already exists`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for inconsistentDailyCalls", async () => {
    eserviceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(inconsistentDailyCalls());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      "dailyCallsPerConsumer can't be greater than dailyCallsTotal"
    );
    expect(res.status).toBe(400);
  });

  it("Should return 409 for eserviceTemplateWithoutPublishedVersion", async () => {
    eserviceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateWithoutPublishedVersion(eserviceTemplateId)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${eserviceTemplateId} does not have a published version`
    );
    expect(res.status).toBe(409);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });
});
