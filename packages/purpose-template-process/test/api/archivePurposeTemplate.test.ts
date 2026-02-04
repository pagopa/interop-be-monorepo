/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import request from "supertest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateId,
  PurposeTemplateId,
  purposeTemplateState,
} from "pagopa-interop-models";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateStateConflict,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API POST /purposeTemplates/{id}/archive", () => {
  const purposeTemplate = getMockPurposeTemplate();
  const serviceResponse = getMockWithMetadata(purposeTemplate);

  beforeEach(() => {
    purposeTemplateService.archivePurposeTemplate = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = purposeTemplate.id
  ) =>
    request(api)
      .post(`/purposeTemplates/${purposeTemplateId}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
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
    {
      error: purposeTemplateNotInExpectedStates(
        purposeTemplate.id,
        purposeTemplateState.draft,
        [purposeTemplateState.archived]
      ),
      expectedStatus: 409,
    },
    { error: tenantNotAllowed(generateId()), expectedStatus: 404 },
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: purposeTemplateStateConflict(
        generateId(),
        purposeTemplateState.archived
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.archivePurposeTemplate = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if an invalid purpose template id is passed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
