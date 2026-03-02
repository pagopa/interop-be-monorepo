/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  generateId,
  PurposeTemplateId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  eServiceDescriptorPurposeTemplateNotFound,
  purposeTemplateNotFound,
} from "../../src/model/domain/errors.js";
import { api, purposeTemplateService } from "../vitest.api.setup.js";
import { eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposeTemplates/:id/eservices/:eserviceId", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const eserviceId = generateId<EServiceId>();
  const purposeTemplateEServiceDescriptor1: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId,
      eserviceId,
      descriptorId: generateId(),
      createdAt: new Date(),
    };

  const purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate =
    purposeTemplateEServiceDescriptor1;

  const apiResponse =
    purposeTemplateApi.EServiceDescriptorPurposeTemplate.parse(
      eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate(
        purposeTemplateEServiceDescriptor
      )
    );

  beforeEach(() => {
    purposeTemplateService.getPurposeTemplateEServiceDescriptor = vi
      .fn()
      .mockResolvedValue(purposeTemplateEServiceDescriptor);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    eserviceId: EServiceId = generateId()
  ) =>
    request(api)
      .get(`/purposeTemplates/${purposeTemplateId}/eservices/${eserviceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
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
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorPurposeTemplateNotFound(
        generateId(),
        generateId()
      ),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeTemplateService.getPurposeTemplateEServiceDescriptor = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      purposeTemplateId: "invalid" as PurposeTemplateId,
      eserviceId,
    },
    {
      purposeTemplateId,
      eserviceId: "invalid" as EServiceId,
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeTemplateId, eserviceId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeTemplateId, eserviceId);
      expect(res.status).toBe(400);
    }
  );
});
