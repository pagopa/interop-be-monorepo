/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import {
  purposeTemplateNotFound,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /purposeTemplates/{id}", () => {
  const serviceResponse: WithMetadata<PurposeTemplate> = getMockWithMetadata(
    getMockPurposeTemplate()
  );

  purposeTemplateService.deletePurposeTemplate = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    id: PurposeTemplateId = serviceResponse.data.id
  ) =>
    request(api)
      .delete(`/purposeTemplates/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

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
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, serviceResponse.data.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: purposeTemplateNotInExpectedStates(
        serviceResponse.data.id,
        purposeTemplateState.active,
        [purposeTemplateState.draft]
      ),
      expectedStatus: 409,
    },
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: 403,
    },
    {
      error: purposeTemplateRiskAnalysisFormNotFound(generateId()),
      expectedStatus: 500,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.deletePurposeTemplate = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, serviceResponse.data.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if an invalid purpose template id is passed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);

    expect(res.status).toBe(400);
  });
});
