/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  attributeKind,
  Descriptor,
  descriptorState,
  EService,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getMockAuthData,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { unchangedAttributes } from "../../src/model/domain/errors.js";

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
    riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
  };

  vi.spyOn(catalogService, "updateDescriptorAttributes").mockResolvedValue(
    mockEService
  );

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .post(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/attributes/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(validMockDescriptorAttributeSeed);

  it.each([userRoles.ADMIN_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEService.id, descriptor.id);
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(userRoles).filter((role) => role !== userRoles.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "", "");
    expect(res.status).toBe(404);
  });

  it("Should return 409 Conflict if descriptor update has a conflict", async () => {
    vi.spyOn(catalogService, "updateDescriptorAttributes").mockRejectedValue(
      unchangedAttributes(mockEService.id, descriptor.id)
    );

    const res = await makeRequest(
      generateToken(getMockAuthData()),
      mockEService.id,
      descriptor.id
    );

    expect(res.status).toBe(409);
  });
});
