/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { describe, it, expect, vi } from "vitest";
import {
  EServiceDocumentId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId", () => {
  const content = new Uint8Array(100).map(() =>
    Math.floor(Math.random() * 256)
  );

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    eServiceTemplateVersionId: EServiceTemplateVersionId = generateId(),
    documentId: EServiceDocumentId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each([
    { contentType: "application/octet-stream", document: Buffer.from(content) },
    { contentType: "application/pdf", document: Buffer.from(content) },
  ])(
    "Should return 200 for user with role Admin",
    async ({ contentType, document }) => {
      services.eServiceTemplateService.getEServiceTemplateDocument = vi
        .fn()
        .mockResolvedValue({ contentType, document });
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.headers[constants.HTTP2_HEADER_CONTENT_TYPE]).toBe(
        contentType
      );
      expect(res.body).toEqual(document);
    }
  );

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { eServiceTemplateVersionId: "invalid" as EServiceTemplateVersionId },
    { documentId: "invalid" as EServiceDocumentId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, eServiceTemplateVersionId, documentId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId,
        documentId
      );
      expect(res.status).toBe(400);
    }
  );
});
