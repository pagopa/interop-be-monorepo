/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  EServiceTemplateVersionPurposeTemplate,
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist,
  disassociationEServiceTemplatesFromPurposeTemplateFailed,
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  tooManyEServiceTemplatesForPurposeTemplate,
} from "../../src/model/domain/errors.js";
import { eserviceTemplateNotAssociatedError } from "../../src/errors/purposeTemplateValidationErrors.js";

describe("API POST /purposeTemplates/:id/unlinkEserviceTemplates", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const purposeTemplateId: PurposeTemplateId = generateId<PurposeTemplateId>();
  const eserviceTemplateIds: EServiceTemplateId[] = [
    generateId<EServiceTemplateId>(),
    generateId<EServiceTemplateId>(),
  ];

  const mockUnlinkResponses: Array<
    WithMetadata<EServiceTemplateVersionPurposeTemplate>
  > = [
    {
      data: {
        purposeTemplateId,
        eserviceTemplateId: eserviceTemplateIds[0],
        eserviceTemplateVersionId: generateId<EServiceTemplateVersionId>(),
        createdAt: new Date(),
      },
      metadata: { version: 1 },
    },
    {
      data: {
        purposeTemplateId,
        eserviceTemplateId: eserviceTemplateIds[1],
        eserviceTemplateVersionId: generateId<EServiceTemplateVersionId>(),
        createdAt: new Date(),
      },
      metadata: { version: 1 },
    },
  ];

  const validUnlinkRequest: purposeTemplateApi.linkEServiceTemplatesToPurposeTemplate_Body =
    {
      eserviceTemplateIds,
    };

  beforeEach(() => {
    purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate = vi
      .fn()
      .mockResolvedValue(mockUnlinkResponses);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string,
    unlinkRequest: purposeTemplateApi.linkEServiceTemplatesToPurposeTemplate_Body
  ) =>
    request(api)
      .post(`/purposeTemplates/${purposeTemplateId}/unlinkEserviceTemplates`)
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
        purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate
      ).toHaveBeenCalledWith(
        purposeTemplateId,
        eserviceTemplateIds,
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

  it("Should return 400 when eserviceTemplateIds is empty", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = { eserviceTemplateIds: [] };
    const res = await makeRequest(token, purposeTemplateId, invalidRequest);
    expect(res.status).toBe(400);
  });

  it("Should return 400 when eserviceTemplateIds contains invalid UUID", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = { eserviceTemplateIds: ["invalid-uuid"] };
    const res = await makeRequest(token, purposeTemplateId, invalidRequest);
    expect(res.status).toBe(400);
  });

  it("Should return 400 when eserviceTemplateIds is not an array", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = { eserviceTemplateIds: "not-an-array" };
    const res = await makeRequest(
      token,
      purposeTemplateId,
      invalidRequest as unknown as purposeTemplateApi.linkEServiceTemplatesToPurposeTemplate_Body
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 when eserviceTemplateIds is missing", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidRequest = {};
    const res = await makeRequest(
      token,
      purposeTemplateId,
      invalidRequest as unknown as purposeTemplateApi.linkEServiceTemplatesToPurposeTemplate_Body
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
    purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate = vi
      .fn()
      .mockRejectedValue(new Error("Service error"));

    const res = await makeRequest(token, purposeTemplateId, validUnlinkRequest);
    expect(res.status).toBe(500);
  });

  it.each([
    {
      error: tooManyEServiceTemplatesForPurposeTemplate(
        eserviceTemplateIds.length,
        10
      ),
      expectedStatus: 400,
    },
    {
      error: disassociationEServiceTemplatesFromPurposeTemplateFailed(
        [
          eserviceTemplateNotAssociatedError(
            eserviceTemplateIds[0],
            purposeTemplateId
          ),
        ],
        eserviceTemplateIds,
        purposeTemplateId
      ),
      expectedStatus: 400,
    },
    {
      error: purposeTemplateNotFound(purposeTemplateId),
      expectedStatus: 404,
    },
    {
      error: associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist(
        [
          eserviceTemplateNotAssociatedError(
            eserviceTemplateIds[0],
            purposeTemplateId
          ),
        ],
        eserviceTemplateIds,
        purposeTemplateId
      ),
      expectedStatus: 409,
    },
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplateId,
        purposeTemplateState.suspended,
        [purposeTemplateState.draft, purposeTemplateState.published]
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.unlinkEServiceTemplatesFromPurposeTemplate = vi
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
