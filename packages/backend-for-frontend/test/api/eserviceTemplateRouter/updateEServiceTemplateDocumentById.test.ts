/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceDocumentId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiUpdateEServiceTemplateVersionDocumentSeed } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId/update", () => {
  const mockUpdateEServiceTemplateVersionDocumentSeed =
    getMockBffApiUpdateEServiceTemplateVersionDocumentSeed();

  beforeEach(() => {
    services.eServiceTemplateService.updateEServiceTemplateDocumentById = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    eServiceTemplateVersionId: EServiceTemplateVersionId = generateId(),
    documentId: EServiceDocumentId = generateId(),
    body: bffApi.UpdateEServiceTemplateVersionDocumentSeed = mockUpdateEServiceTemplateVersionDocumentSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { eServiceTemplateVersionId: "invalid" as EServiceTemplateVersionId },
    { documentId: "invalid" as EServiceDocumentId },
    { body: {} },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionDocumentSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionDocumentSeed,
        prettyName: "a".repeat(4),
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateVersionDocumentSeed,
        prettyName: "a".repeat(61),
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({
      eServiceTemplateId,
      eServiceTemplateVersionId,
      documentId,
      body,
    }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId,
        documentId,
        body as bffApi.UpdateEServiceTemplateVersionDocumentSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
