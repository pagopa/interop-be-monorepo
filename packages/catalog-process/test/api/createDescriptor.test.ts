/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Attribute,
  Descriptor,
  EService,
  generateId,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
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

  catalogService.createDescriptor = vi.fn().mockResolvedValue(newDescriptor);

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(descriptorSeed);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id);

      expect(res.body).toEqual(apiDescriptor);
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
    expect(res.status).toBe(404);
  });
});
