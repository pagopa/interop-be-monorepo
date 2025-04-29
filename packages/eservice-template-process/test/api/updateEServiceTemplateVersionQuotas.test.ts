/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  eserviceTemplateVersionState,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("API POST /templates/:templateId/versions/:templateVersionId/quotas/update", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const mockSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed =
    { voucherLifespan: 60 };

  const makeRequest = async (
    token: string,
    seed: eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed = mockSeed,
    templateId: string = mockEserviceTemplate.id,
    templateVersionId: string = mockEserviceTemplate.versions[0].id
  ) =>
    request(api)
      .post(
        `/templates/${templateId}/versions/${templateVersionId}/quotas/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(seed);

  beforeEach(() => {
    eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplate);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(
        eserviceTemplateToApiEServiceTemplate(mockEserviceTemplate)
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

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
      .fn()
      .mockRejectedValue(eServiceTemplateNotFound(mockEserviceTemplate.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${mockEserviceTemplate.id} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceTemplateVersionNotFound", async () => {
    eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
      .fn()
      .mockRejectedValue(
        eServiceTemplateVersionNotFound(
          mockEserviceTemplate.id,
          mockEserviceTemplate.versions[0].id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${mockEserviceTemplate.id} version ${mockEserviceTemplate.versions[0].id} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });

  it("Should return 400 for notValidEServiceTemplateVersionState", async () => {
    eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
      .fn()
      .mockRejectedValue(
        notValidEServiceTemplateVersionState(
          mockEserviceTemplate.versions[0].id,
          eserviceTemplateVersionState.draft
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService template version ${mockEserviceTemplate.versions[0].id} has a not valid status for this operation ${eserviceTemplateVersionState.draft}`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for inconsistentDailyCalls", async () => {
    eserviceTemplateService.updateEServiceTemplateVersionQuotas = vi
      .fn()
      .mockRejectedValue(inconsistentDailyCalls());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      "dailyCallsPerConsumer can't be greater than dailyCallsTotal"
    );
    expect(res.status).toBe(400);
  });
});
