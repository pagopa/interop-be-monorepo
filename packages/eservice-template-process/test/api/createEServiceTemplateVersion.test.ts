/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Attribute,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import { buildCreateVersionSeed } from "../mockUtils.js";

describe("API POST /templates/:templateId/versions", () => {
  const mockVersion = getMockEServiceTemplateVersion();

  const attribute: Attribute = {
    name: "Attribute name",
    id: generateId(),
    kind: "Declared",
    description: "Attribute Description",
    creationTime: new Date(),
  };

  const versionSeed: eserviceTemplateApi.EServiceTemplateVersionSeed = {
    ...buildCreateVersionSeed(mockVersion),
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id, explicitAttributeVerification: false }]],
      verified: [],
    },
  };

  const newVersion: EServiceTemplateVersion = {
    ...mockVersion,
    version: 1,
    createdAt: new Date(),
    id: mockVersion.id,
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id, explicitAttributeVerification: false }]],
      verified: [],
    },
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

  eserviceTemplateService.createEServiceTemplateVersion = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eserviceTemplateId: EServiceTemplateId,
    body: eserviceTemplateApi.EServiceTemplateVersionSeed = versionSeed
  ) =>
    request(api)
      .post(`/templates/${eserviceTemplateId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
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
});
