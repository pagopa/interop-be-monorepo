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
import {
  generateToken,
  getMockAttribute,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  attributeDuplicatedInGroup,
  attributeNotFound,
  descriptorAttributeGroupSupersetMissingInAttributesSeed,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  inconsistentAttributesSeedGroupsCount,
} from "../../src/model/domain/errors.js";

describe("API /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/attributes/update authorization test", () => {
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

  catalogService.internalUpdateTemplateInstanceDescriptorAttributes = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.AttributesSeed = validMockDescriptorAttributeSeed
  ) =>
    request(api)
      .post(
        `/internal/templates/eservices/${eServiceId}/descriptors/${descriptorId}/attributes/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(mockEService.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: attributeNotFound(generateId()),
      expectedStatus: 404,
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
    {
      error: attributeDuplicatedInGroup(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.internalUpdateTemplateInstanceDescriptorAttributes = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id],
    [
      { certified: null, verified: [], declared: [] },
      mockEService.id,
      descriptor.id,
    ],
    [
      { certified: [], verified: "invalid", declared: [] },
      mockEService.id,
      descriptor.id,
    ],
    [
      { certified: [], verified: [], declared: [{}] },
      mockEService.id,
      descriptor.id,
    ],
    [
      {
        certified: [[{ id: 123, explicitAttributeVerification: false }]],
        verified: [],
        declared: [],
      },
      mockEService.id,
      descriptor.id,
    ],
    [{ ...validMockDescriptorAttributeSeed }, "invalidId", descriptor.id],
    [{ ...validMockDescriptorAttributeSeed }, mockEService.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid attributes seed: %s (eServiceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
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
