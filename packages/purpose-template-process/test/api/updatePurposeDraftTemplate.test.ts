/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  generateId,
  purposeTemplateState,
  tenantKind,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateToApiPurposeTemplate } from "../../src/model/domain/apiConverter.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
} from "../../src/model/domain/errors.js";

describe("API PUT /purposeTemplates/{purposeTemplateId}", () => {
  const OVER_251_CHAR = "Over".repeat(251);
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const mockPurposeTemplate: PurposeTemplate = getMockPurposeTemplate();
  const validPurposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed = {
    targetDescription: "Target description",
    targetTenantKind: tenantKind.PA,
    purposeTitle: "Purpose Template title",
    purposeDescription: "Purpose Template description",
    purposeIsFreeOfCharge: false,
    handlesPersonalData: false,
  };

  const purposeTemplateResponse = getMockWithMetadata(mockPurposeTemplate, 2);

  beforeEach(() => {
    purposeTemplateService.updatePurposeTemplate = vi
      .fn()
      .mockResolvedValue(purposeTemplateResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed
  ) =>
    request(api)
      .put(`/purposeTemplates/${mockPurposeTemplate.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(purposeTemplateSeed);

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, validPurposeTemplateSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        purposeTemplateToApiPurposeTemplate(mockPurposeTemplate)
      );
      expect(res.headers["x-metadata-version"]).toBe(
        purposeTemplateResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, validPurposeTemplateSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    {
      ...validPurposeTemplateSeed,
      targetDescription: "",
    },
    {
      ...validPurposeTemplateSeed,
      targetDescription: OVER_251_CHAR,
    },
    {
      ...validPurposeTemplateSeed,
      targetDescription: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      targetTenantKind: "invalidTenantKind",
    },
    {
      ...validPurposeTemplateSeed,
      targetTenantKind: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: "",
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: "1234",
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: OVER_251_CHAR,
    },
    {
      ...validPurposeTemplateSeed,
      purposeTitle: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      purposeDescription: "123456789",
    },
    {
      ...validPurposeTemplateSeed,
      purposeDescription: undefined,
    },
    {
      ...validPurposeTemplateSeed,
      purposeDescription: OVER_251_CHAR,
    },
    {
      ...validPurposeTemplateSeed,
      purposeIsFreeOfCharge: undefined,
    },
  ])("Should return 400 if risk analysis template is invalid", async (body) => {
    purposeTemplateService.updatePurposeTemplate = vi.fn().mockRejectedValue({
      code: "riskAnalysisTemplateValidationFailed",
      detail: "detail",
    });
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as purposeTemplateApi.PurposeTemplateSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if payload has inconsistent free of charge data", async () => {
    purposeTemplateService.updatePurposeTemplate = vi
      .fn()
      .mockRejectedValue(missingFreeOfChargeReason());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validPurposeTemplateSeed);

    expect(res.status).toBe(400);
  });

  it("Should return 400 if purpose template is not in draft state", async () => {
    purposeTemplateService.updatePurposeTemplate = vi
      .fn()
      .mockRejectedValue(
        purposeTemplateNotInExpectedStates(
          mockPurposeTemplate.id,
          mockPurposeTemplate.state,
          [purposeTemplateState.draft]
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validPurposeTemplateSeed);
    expect(res.status).toBe(400);
  });

  it("Should return 404 if purpose template not found", async () => {
    purposeTemplateService.updatePurposeTemplate = vi
      .fn()
      .mockRejectedValue(purposeTemplateNotFound(mockPurposeTemplate.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validPurposeTemplateSeed);
    expect(res.status).toBe(404);
  });

  it("Should return 409 if purpose template title already exists", async () => {
    purposeTemplateService.updatePurposeTemplate = vi
      .fn()
      .mockRejectedValue(
        purposeTemplateNameConflict(
          mockPurposeTemplate.id,
          validPurposeTemplateSeed.purposeTitle
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, validPurposeTemplateSeed);
    expect(res.status).toBe(409);
  });
});
