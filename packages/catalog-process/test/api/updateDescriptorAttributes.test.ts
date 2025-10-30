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
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  attributeDuplicatedInGroup,
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
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.AttributesSeed = validMockDescriptorAttributeSeed
  ) =>
    request(api)
      .post(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/attributes/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    {
      error: attributeDuplicatedInGroup(generateId()),
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
    [{}, mockEService.id, descriptor.id],
    [validMockDescriptorAttributeSeed, "invalidId", descriptor.id],
    [validMockDescriptorAttributeSeed, mockEService.id, "invalidId"],
    [
      { ...validMockDescriptorAttributeSeed, certified: {} },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...validMockDescriptorAttributeSeed, certified: [123] },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...validMockDescriptorAttributeSeed, certified: [[{ id: 123 }]] },
      mockEService.id,
      descriptor.id,
    ],
    [
      {
        ...validMockDescriptorAttributeSeed,
        verified: [
          [{ id: "", explicitAttributeVerification: "not-a-boolean" }],
        ],
      },
      mockEService.id,
      descriptor.id,
    ],
    [
      {
        ...validMockDescriptorAttributeSeed,
        verified: [[{ noId: true }]],
      },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...validMockDescriptorAttributeSeed, declared: ["not-an-array"] },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...validMockDescriptorAttributeSeed, declared: [[{ id: null }]] },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...validMockDescriptorAttributeSeed, certified: null },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...validMockDescriptorAttributeSeed, verified: null },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...validMockDescriptorAttributeSeed, declared: null },
      mockEService.id,
      descriptor.id,
    ],
    [
      { certified: "wrong", verified: "wrong", declared: "wrong" },
      mockEService.id,
      descriptor.id,
    ],
  ])(
    "Should return 400 if passed invalid attribute seed params: %s (eserviceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
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
