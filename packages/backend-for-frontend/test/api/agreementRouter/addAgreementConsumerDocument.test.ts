/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { services, api } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiAddAgreementConsumerDocumentBody } from "../../mockUtils.js";

describe("API POST /agreements/:agreementId/consumer-documents", async () => {
  const mockAddAgreementConsumerDocumentBody =
    getMockBffApiAddAgreementConsumerDocumentBody();
  const mockBuffer = Buffer.from(
    await mockAddAgreementConsumerDocumentBody.doc.arrayBuffer()
  );

  beforeEach(() => {
    services.agreementService.addAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(mockBuffer);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = generateId(),
    documentBody: bffApi.addAgreementConsumerDocument_Body = mockAddAgreementConsumerDocumentBody
  ) => {
    const requestObject = request(api)
      .post(`${appBasePath}/agreements/${agreementId}/consumer-documents`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

    if (documentBody.name !== undefined) {
      void requestObject.field("name", documentBody.name);
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
    expect(res.body).toEqual(mockBuffer);
  });

  it.each([
    { agreementId: "invalid" as AgreementId },
    { documentBody: {} },
    {
      documentBody: {
        name: mockAddAgreementConsumerDocumentBody.name,
        prettyName: mockAddAgreementConsumerDocumentBody.prettyName,
      },
    },
    {
      documentBody: {
        name: mockAddAgreementConsumerDocumentBody.name,
        doc: mockAddAgreementConsumerDocumentBody.doc,
      },
    },
    {
      documentBody: {
        prettyName: mockAddAgreementConsumerDocumentBody.prettyName,
        doc: mockAddAgreementConsumerDocumentBody.doc,
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ agreementId, documentBody }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        agreementId,
        documentBody as unknown as bffApi.addAgreementConsumerDocument_Body
      );
      expect(res.status).toBe(400);
    }
  );
});
