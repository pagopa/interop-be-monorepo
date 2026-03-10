/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { purposeTemplateToApiPurposeTemplate } from "../../src/model/domain/apiConverter.js";
import {
  invalidFreeOfChargeReason,
  missingFreeOfChargeReason,
  purposeTemplateTitleConflict,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("PATCH /purposeTemplates/{id} router test", () => {
  const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_OK,
    HTTP_STATUS_CONFLICT,
    HTTP_STATUS_FORBIDDEN,
  } = constants;

  const mockPurposeTemplate = getMockPurposeTemplate();

  const serviceResponse = getMockWithMetadata(mockPurposeTemplate);
  const apiPurposeTemplate = purposeTemplateApi.PurposeTemplate.parse(
    purposeTemplateToApiPurposeTemplate(mockPurposeTemplate)
  );

  const purposeTemplateSeed: purposeTemplateApi.PatchUpdatePurposeTemplateSeed =
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
      purposeDailyCalls: 10,
      handlesPersonalData: true,
    };

  purposeTemplateService.patchUpdatePurposeTemplate = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    purposeTemplateId: string,
    body: purposeTemplateApi.PatchUpdatePurposeTemplateSeed = purposeTemplateSeed
  ) =>
    request(api)
      .patch(`/purposeTemplates/${purposeTemplateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockPurposeTemplate.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiPurposeTemplate);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each([
    {},
    { targetDescription: "updated target description" },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeDailyCalls: 10,
      purposeFreeOfChargeReason: null,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
      purposeDailyCalls: null,
      handlesPersonalData: true,
    },
  ] satisfies purposeTemplateApi.PatchUpdatePurposeTemplateSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurposeTemplate.id, seed);
      expect(res.status).toBe(HTTP_STATUS_OK);
    }
  );

  it.each([
    [{ targetDescription: null }, mockPurposeTemplate.id],
    [{ targetTenantKind: "invalidTenantKind" }, mockPurposeTemplate.id],
    [{ purposeTitle: null }, mockPurposeTemplate.id],
    [{ purposeDescription: null }, mockPurposeTemplate.id],
    [{ purposeIsFreeOfCharge: "notABoolean" }, mockPurposeTemplate.id],
    [{ purposeFreeOfChargeReason: -5 }, mockPurposeTemplate.id],
    [{ purposeDailyCalls: -5 }, mockPurposeTemplate.id],
    [{ handlesPersonalData: "notABoolean" }, mockPurposeTemplate.id],
    [{ ...purposeTemplateSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid seed or purpose template id (seed #%#)",
    async (body, purposeTemplateId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId as PurposeTemplateId,
        body as purposeTemplateApi.PatchUpdatePurposeTemplateSeed
      );

      expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockPurposeTemplate.id);

    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN);
  });

  it.each([
    {
      error: riskAnalysisTemplateValidationFailed([]),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: missingFreeOfChargeReason(),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: HTTP_STATUS_FORBIDDEN,
    },
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: HTTP_STATUS_NOT_FOUND,
    },
    {
      error: purposeTemplateTitleConflict([generateId()], "Duplicate Name"),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        generateId(),
        purposeTemplateState.published,
        [purposeTemplateState.draft]
      ),
      expectedStatus: HTTP_STATUS_CONFLICT,
    },
    {
      error: invalidFreeOfChargeReason(false, ""),
      expectedStatus: HTTP_STATUS_BAD_REQUEST,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.patchUpdatePurposeTemplate = vi
        .fn()
        .mockRejectedValueOnce(error);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurposeTemplate.id);

      expect(res.status).toBe(expectedStatus);
    }
  );
});
