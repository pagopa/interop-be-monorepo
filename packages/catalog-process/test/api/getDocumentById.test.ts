/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  descriptorState,
  Document,
  EService,
  generateId,
} from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { documentToApiDocument } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId} authorization test", () => {
  const document: Document = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    docs: [document],
  };
  const eservice: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiDocument = catalogApi.EServiceDoc.parse(
    documentToApiDocument(document)
  );

  vi.spyOn(catalogService, "getDocumentById").mockResolvedValue(document);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string,
    documentId: string
  ) =>
    request(api)
      .get(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it.each([
    userRoles.ADMIN_ROLE,
    userRoles.API_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.M2M_ROLE,
    userRoles.SUPPORT_ROLE,
  ])("Should return 204 for user with role %s", async (role) => {
    const token = generateToken({
      ...getMockAuthData(),
      userRoles: [role],
    });
    const res = await makeRequest(
      token,
      eservice.id,
      descriptor.id,
      document.id
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiDocument);
  });

  it.each([userRoles.INTERNAL_ROLE, userRoles.MAINTENANCE_ROLE])(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(
        token,
        eservice.id,
        descriptor.id,
        document.id
      );

      expect(res.status).toBe(403);
    }
  );

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "", "", "");
    expect(res.status).toBe(404);
  });
});
