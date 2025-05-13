/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  attributeKind,
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import {
  attributeNotFound,
  descriptorAttributeGroupSupersetMissingInAttributesSeed,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  inconsistentAttributesSeedGroupsCount,
  templateInstanceNotAllowed,
  unchangedAttributes,
} from "../../src/model/domain/errors.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/attributes/update authorization test", () => {
  const mockCertifiedAttribute1 = getMockAttribute(attributeKind.certified);
  const mockCertifiedAttribute2 = getMockAttribute(attributeKind.certified);
  const validMockDescriptorCertifiedAttributes = [
    [
      {
        id: mockCertifiedAttribute1.id,
        explicitAttributeVerification: false,
      },
      {
        id: mockCertifiedAttribute2.id,
        explicitAttributeVerification: false,
      },
    ],
  ];

  const mockVerifiedAttribute1 = getMockAttribute(attributeKind.verified);
  const mockVerifiedAttribute2 = getMockAttribute(attributeKind.verified);

  const validMockDescriptorVerifiedAttributes = [
    [
      {
        id: mockVerifiedAttribute1.id,
        explicitAttributeVerification: false,
      },
    ],
    [
      {
        id: mockVerifiedAttribute2.id,
        explicitAttributeVerification: false,
      },
    ],
  ];

  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    attributes: {
      certified: validMockDescriptorCertifiedAttributes,
      verified: validMockDescriptorVerifiedAttributes,
      declared: [],
    },
  };

  const validMockDescriptorAttributeSeed: catalogApi.AttributesSeed = {
    certified: [
      [
        ...validMockDescriptorCertifiedAttributes[0],
        {
          id: generateId(),
          explicitAttributeVerification: false,
        },
      ],
    ],
    verified: [
      [
        ...validMockDescriptorVerifiedAttributes[0],
        {
          id: generateId(),
          explicitAttributeVerification: false,
        },
      ],
      validMockDescriptorVerifiedAttributes[1],
    ],
    declared: [],
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  catalogService.updateDescriptorAttributes = vi
    .fn()
    .mockResolvedValue(mockEService);

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string,
    body: catalogApi.AttributesSeed = validMockDescriptorAttributeSeed
  ) =>
    request(api)
      .post(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/attributes/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiEservice);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: unchangedAttributes(mockEService.id, descriptor.id),
      expectedStatus: 409,
    },
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(mockEService.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: attributeNotFound(mockVerifiedAttribute1.id),
      expectedStatus: 404,
    },
    {
      error: templateInstanceNotAllowed(
        mockEService.id,
        mockEService.templateId!
      ),
      expectedStatus: 403,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: inconsistentAttributesSeedGroupsCount(
        mockEService.id,
        descriptor.id
      ),
      expectedStatus: 400,
    },
    {
      error: descriptorAttributeGroupSupersetMissingInAttributesSeed(
        mockEService.id,
        descriptor.id
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateDescriptorAttributes = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: {},
    },
    {
      eServiceId: "invalidId",
      descriptorId: descriptor.id,
      body: validMockDescriptorAttributeSeed,
    },
    {
      eServiceId: mockEService.id,
      descriptorId: "invalidId",
      body: validMockDescriptorAttributeSeed,
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, certified: {} },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, certified: [123] },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, certified: [[{ id: 123 }]] },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: {
        ...validMockDescriptorAttributeSeed,
        verified: [
          [{ id: "", explicitAttributeVerification: "not-a-boolean" }],
        ],
      },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: {
        ...validMockDescriptorAttributeSeed,
        verified: [[{ noId: true }]],
      },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, declared: ["not-an-array"] },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, declared: [[{ id: null }]] },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, certified: null },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, verified: null },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { ...validMockDescriptorAttributeSeed, declared: null },
    },
    {
      eServiceId: mockEService.id,
      descriptorId: descriptor.id,
      body: { certified: "wrong", verified: "wrong", declared: "wrong" },
    },
  ])(
    "Should return 400 if passed invalid params",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.AttributesSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
