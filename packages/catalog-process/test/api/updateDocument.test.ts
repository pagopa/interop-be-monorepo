/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
} from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { documentToApiDocument } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update authorization test", () => {
  const mockDocument = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    docs: [mockDocument],
    state: descriptorState.archived,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiDocument = catalogApi.EServiceDoc.parse(
    documentToApiDocument(mockDocument)
  );

  vi.spyOn(catalogService, "updateDocument").mockResolvedValue(mockDocument);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string,
    documentId: string
  ) =>
    request(api)
      .post(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ prettyName: "updated prettyName" });

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(
        token,
        mockEService.id,
        descriptor.id,
        mockDocument.id
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDocument);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(
      token,
      mockEService.id,
      descriptor.id,
      mockDocument.id
    );

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "", "", "");
    expect(res.status).toBe(404);
  });
});
