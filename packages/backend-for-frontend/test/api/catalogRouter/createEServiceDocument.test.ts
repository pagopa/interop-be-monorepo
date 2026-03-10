/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  invalidContentTypeDetected,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiCreateEServiceDocumentBody,
} from "../../mockUtils.js";
import { eserviceDescriptorNotFound } from "../../../src/model/errors.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/documents", () => {
  const mockApiCreatedResource = getMockBffApiCreatedResource();
  const mockCreateDocumentBody = getMockBffApiCreateEServiceDocumentBody();

  beforeEach(() => {
    services.catalogService.createEServiceDocument = vi
      .fn()
      .mockResolvedValue(mockApiCreatedResource);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    documentBody: bffApi.createEServiceDocument_Body = mockCreateDocumentBody
  ) => {
    const requestObject = request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/documents`
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

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it.each([
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidContentTypeDetected(
        { id: generateId(), isEserviceTemplate: false },
        "contentType",
        "REST"
      ),
      expectedStatus: 400,
    },
    {
      error: invalidInterfaceFileDetected({
        id: generateId(),
        isEserviceTemplate: false,
      }),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.createEServiceDocument = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
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
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, descriptorId, documentBody }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        documentBody as bffApi.createEServiceDocument_Body
      );
      expect(res.status).toBe(400);
    }
  );
});
