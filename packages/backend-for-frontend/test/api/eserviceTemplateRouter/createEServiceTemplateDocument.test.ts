/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
  invalidContentTypeDetected,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiCreateEServiceDocumentBody,
} from "../../mockUtils.js";
import { eserviceTemplateVersionNotFound } from "../../../src/model/errors.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents", () => {
  const mockCreatedResource = getMockBffApiCreatedResource();
  const mockCreateDocumentBody = getMockBffApiCreateEServiceDocumentBody();

  beforeEach(() => {
    services.eServiceTemplateService.createEServiceTemplateDocument = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    eServiceTemplateVersionId: EServiceTemplateVersionId = generateId(),
    documentBody: bffApi.createEServiceDocument_Body = mockCreateDocumentBody
  ) => {
    const requestObject = request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}/documents`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

    if (documentBody.kind !== undefined) {
      void requestObject.field("kind", documentBody.kind);
    }
    if (documentBody.prettyName !== undefined) {
      void requestObject.field("prettyName", documentBody.prettyName);
    }
    if (documentBody.doc !== undefined) {
      void requestObject.attach(
        "doc",
        Buffer.from(await documentBody.doc.arrayBuffer()),
        {
          filename: documentBody.doc.name,
        }
      );
    }

    return requestObject;
  };

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
      error: invalidContentTypeDetected(
        { id: generateId(), isEserviceTemplate: true },
        "contentType",
        "technology"
      ),
      expectedStatus: 400,
    },
    {
      error: invalidInterfaceFileDetected({
        id: generateId(),
        isEserviceTemplate: true,
      }),
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
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { eServiceTemplateVersionId: "invalid" as EServiceTemplateVersionId },
    { documentBody: {} },
    {
      documentBody: {
        kind: mockCreateDocumentBody.kind,
        prettyName: mockCreateDocumentBody.prettyName,
      },
    },
    {
      documentBody: {
        kind: mockCreateDocumentBody.kind,
        doc: mockCreateDocumentBody.doc,
      },
    },
    {
      documentBody: {
        prettyName: mockCreateDocumentBody.prettyName,
        doc: mockCreateDocumentBody.doc,
      },
    },
    {
      documentBody: {
        ...mockCreateDocumentBody,
        kind: "invalid",
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, eServiceTemplateVersionId, documentBody }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId,
        documentBody as bffApi.createEServiceDocument_Body
      );
      expect(res.status).toBe(400);
    }
  );
});
