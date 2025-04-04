/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  Document,
  EService,
  EServiceDocumentId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";

describe("API /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update authorization test", () => {
  const document: Document = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    docs: [document],
  };
  const eservice: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  vi.spyOn(
    catalogService,
    "internalDeleteTemplateInstanceDescriptorDocument"
  ).mockResolvedValue();

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    documentId: EServiceDocumentId
  ) =>
    request(api)
      .delete(
        `/internal/templates/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken({
      ...getMockAuthData(),
      userRoles: [userRoles.INTERNAL_ROLE],
    });
    const res = await makeRequest(
      token,
      eservice.id,
      descriptor.id,
      document.id
    );
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(userRoles).filter((role) => role !== userRoles.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(
      token,
      eservice.id,
      descriptor.id,
      document.id
    );

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(
      generateToken(getMockAuthData()),
      "" as EServiceId,
      "" as DescriptorId,
      "" as EServiceDocumentId
    );
    expect(res.status).toBe(404);
  });
});
