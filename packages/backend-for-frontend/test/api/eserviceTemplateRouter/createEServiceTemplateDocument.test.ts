/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCreatedResource } from "../../mockUtils.js";
import { eserviceTemplateVersionNotFound } from "../../../src/model/errors.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents", () => {
  const mockEServiceTemplateId = generateId<EServiceTemplateId>();
  const mockEServiceTemplateVersionId = generateId<EServiceTemplateVersionId>();
  const mockCreatedResource = getMockBffApiCreatedResource();

  beforeEach(() => {
    services.eServiceTemplateService.createEServiceTemplateDocument = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: string = mockEServiceTemplateId,
    eServiceTemplateVersionId: string = mockEServiceTemplateVersionId,
    kind: string = "DOCUMENT",
    prettyName: string = "prettyName"
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}/documents`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .field("kind", kind)
      .field("prettyName", prettyName)
      .attach("doc", Buffer.from("content"), { filename: "doc.txt" });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it.each([
    {
      error: eserviceTemplateVersionNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidInterfaceContentTypeDetected(
        generateId(),
        "contentType",
        "technology"
      ),
      expectedStatus: 400,
    },
    {
      error: invalidInterfaceFileDetected(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.eServiceTemplateService.createEServiceTemplateDocument = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { eServiceTemplateId: "invalid" },
    { eServiceTemplateVersionId: "invalid" },
    { kind: "invalid" },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, eServiceTemplateVersionId, kind }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId,
        kind
      );
      expect(res.status).toBe(400);
    }
  );
});
