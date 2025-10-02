/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  tooManyEServicesForPurposeTemplate,
  disassociationEServicesFromPurposeTemplateFailed,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { eserviceNotAssociatedError } from "../../src/errors/purposeTemplateValidationErrors.js";

describe("API POST /purposeTemplates/:id/unlinkEservices", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId: PurposeTemplateId = generateId<PurposeTemplateId>();
  const eserviceIds: EServiceId[] = [
    generateId<EServiceId>(),
    generateId<EServiceId>(),
  ];

  const validUnlinkRequest: purposeTemplateApi.linkEServicesToPurposeTemplate_Body =
    {
      eserviceIds,
    };

  beforeEach(() => {
    purposeTemplateService.unlinkEservicesFromPurposeTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string,
    unlinkRequest: purposeTemplateApi.linkEServicesToPurposeTemplate_Body
  ) =>
    request(api)
      .post(`/purposeTemplates/${purposeTemplateId}/unlinkEservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(unlinkRequest);

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        validUnlinkRequest
      );
      expect(res.status).toBe(204);
      expect(
        purposeTemplateService.unlinkEservicesFromPurposeTemplate
      ).toHaveBeenCalledWith(
        purposeTemplateId,
        eserviceIds,
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, purposeTemplateId, validUnlinkRequest);
    expect(res.status).toBe(403);
  });

  it("Should return 400 when eserviceIds is empty", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = { eserviceIds: [] };
    const res = await makeRequest(token, purposeTemplateId, invalidRequest);
    expect(res.status).toBe(400);
  });

  it("Should return 400 when eserviceIds contains invalid UUID", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = { eserviceIds: ["invalid-uuid"] };
    const res = await makeRequest(token, purposeTemplateId, invalidRequest);
    expect(res.status).toBe(400);
  });

  it("Should return 400 when eserviceIds is not an array", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = { eserviceIds: "not-an-array" };
    const res = await makeRequest(
      token,
      purposeTemplateId,
      invalidRequest as unknown as purposeTemplateApi.linkEServicesToPurposeTemplate_Body
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 when eserviceIds is missing", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = {};
    const res = await makeRequest(
      token,
      purposeTemplateId,
      invalidRequest as unknown as purposeTemplateApi.linkEServicesToPurposeTemplate_Body
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 when purposeTemplateId is invalid UUID", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid-uuid", validUnlinkRequest);
    expect(res.status).toBe(400);
  });

  it("Should return 500 when service throws an error", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    purposeTemplateService.unlinkEservicesFromPurposeTemplate = vi
      .fn()
      .mockRejectedValue(new Error("Service error"));

    const res = await makeRequest(token, purposeTemplateId, validUnlinkRequest);
    expect(res.status).toBe(500);
  });

  it.each([
    {
      error: tooManyEServicesForPurposeTemplate(eserviceIds.length, 10),
      expectedStatus: 400,
    },
    {
      error: disassociationEServicesFromPurposeTemplateFailed(
        [eserviceNotAssociatedError(eserviceIds[0], purposeTemplateId)],
        eserviceIds,
        purposeTemplateId
      ),
      expectedStatus: 400,
    },
    {
      error: purposeTemplateNotFound(purposeTemplateId),
      expectedStatus: 404,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplateId,
        purposeTemplateState.suspended,
        [purposeTemplateState.draft, purposeTemplateState.active]
      ),
      expectedStatus: 400,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplateId,
        purposeTemplateState.archived,
        [purposeTemplateState.draft, purposeTemplateState.active]
      ),
      expectedStatus: 400,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.unlinkEservicesFromPurposeTemplate = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        validUnlinkRequest
      );
      expect(res.status).toBe(expectedStatus);
    }
  );
});
