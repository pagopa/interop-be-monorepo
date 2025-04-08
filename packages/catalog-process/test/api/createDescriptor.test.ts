/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Attribute,
  Descriptor,
  EService,
  generateId,
} from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { descriptorToApiDescriptor } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/descriptors authorization test", () => {
  const buildCreateDescriptorSeed = (
    descriptor: Descriptor
  ): catalogApi.EServiceDescriptorSeed => ({
    audience: descriptor.audience,
    voucherLifespan: descriptor.voucherLifespan,
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    agreementApprovalPolicy: "AUTOMATIC",
    description: descriptor.description,
    attributes: {
      certified: [],
      declared: [],
      verified: [],
    },
    docs: descriptor.docs.map((d) => ({
      ...d,
      kind: "DOCUMENT",
      serverUrls: [],
      documentId: d.id,
      filePath: d.path,
      fileName: d.name,
    })),
  });

  const mockDescriptor = {
    ...getMockDescriptor(),
    docs: [],
  };

  const attribute: Attribute = {
    name: "Attribute name",
    id: generateId(),
    kind: "Declared",
    description: "Attribute Description",
    creationTime: new Date(),
  };

  const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
    ...buildCreateDescriptorSeed(mockDescriptor),
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id, explicitAttributeVerification: false }]],
      verified: [],
    },
  };

  const newDescriptor = {
    ...mockDescriptor,
    version: "1",
    createdAt: new Date(),
    id: mockDescriptor.id,
    serverUrls: [],
    attributes: {
      certified: [],
      declared: [[{ id: attribute.id, explicitAttributeVerification: false }]],
      verified: [],
    },
  };

  const eservice: EService = {
    ...getMockEService(),
    descriptors: [newDescriptor],
  };

  const apiDescriptor = catalogApi.EServiceDescriptor.parse(
    descriptorToApiDescriptor(newDescriptor)
  );

  vi.spyOn(catalogService, "createDescriptor").mockResolvedValue(newDescriptor);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(descriptorSeed);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({
        ...getMockAuthData(),
        userRoles: [role],
      });
      const res = await makeRequest(token, eservice.id);

      expect(res.body).toEqual(apiDescriptor);
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "");
    expect(res.status).toBe(404);
  });
});
