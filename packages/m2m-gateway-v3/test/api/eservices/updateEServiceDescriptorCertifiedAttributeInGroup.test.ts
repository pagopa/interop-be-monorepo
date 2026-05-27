import type { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { type AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiEServiceAttribute,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { ApiError, generateId, unsafeBrandId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorAttributeGroupNotFound,
  eserviceDescriptorAttributeNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { api, mockEserviceService } from "../../vitest.api.setup.js";

describe("PATCH /eservices/{eserviceId}/descriptors/{descriptorId}/certifiedAttributes/groups/{groupIndex}/attributes/{attributeId} router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const mockSeed: m2mGatewayApiV3.EServiceDescriptorAttributeSeed = {
    dailyCallsPerConsumer: 100,
  };

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string,
    groupIndex: number,
    attributeId: string,
    body: m2mGatewayApiV3.EServiceDescriptorAttributeSeed
  ) =>
    request(api)
      .patch(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/certifiedAttributes/groups/${groupIndex}/attributes/${attributeId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const mockApiAttribute = getMockedApiEServiceAttribute();
  const mockApiEServiceDescriptor = getMockedApiEserviceDescriptor({
    attributes: {
      certified: [
        [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
        [mockApiAttribute],
      ],
      declared: [],
      verified: [],
    },
  });
  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiEServiceDescriptor],
  });
  const mockM2MEserviceResponse = toM2MGatewayApiEService(mockApiEservice);

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
        vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockM2MEserviceResponse.id,
        mockApiEServiceDescriptor.id,
        1,
        mockApiAttribute.id,
        mockSeed
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(
        mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup
      ).toHaveBeenCalledWith(
        unsafeBrandId(mockM2MEserviceResponse.id),
        unsafeBrandId(mockApiEServiceDescriptor.id),
        1,
        unsafeBrandId(mockApiAttribute.id),
        mockSeed,
        expect.anything()
      );
    }
  );

  it("Should return 400 for incorrect value for eservice id", async () => {
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID",
      generateId(),
      0,
      generateId(),
      mockSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for descriptor id", async () => {
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      "INVALID ID",
      0,
      generateId(),
      mockSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for group index", async () => {
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      -1,
      generateId(),
      mockSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for attribute id", async () => {
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      "INVALID ID",
      mockSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for dailyCallsPerConsumer below minimum", async () => {
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      generateId(),
      { dailyCallsPerConsumer: 0 }
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for dailyCallsPerConsumer above maximum", async () => {
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      generateId(),
      { dailyCallsPerConsumer: 1000000001 }
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for unsupported properties in body", async () => {
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      generateId(),
      {
        dailyCallsPerConsumer: 100,
        nastyProperty: "should not be allowed",
      } as m2mGatewayApiV3.EServiceDescriptorAttributeSeed
    );
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      generateId(),
      mockSeed
    );
    expect(res.status).toBe(403);
  });

  it("Should return 404 if descriptor not found", async () => {
    const nonExistentDescriptorId = generateId();
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorNotFound(
          unsafeBrandId(generateId()),
          unsafeBrandId(nonExistentDescriptorId)
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      nonExistentDescriptorId,
      0,
      generateId(),
      mockSeed
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 if attribute group not found", async () => {
    const nonExistentGroupIndex = 99;
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorAttributeGroupNotFound(
          "certified",
          unsafeBrandId(generateId()),
          unsafeBrandId(generateId()),
          nonExistentGroupIndex
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      nonExistentGroupIndex,
      generateId(),
      mockSeed
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 if attribute not found in group", async () => {
    const nonExistentAttributeId = generateId();
    mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorAttributeNotFound(
          unsafeBrandId(nonExistentAttributeId)
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      nonExistentAttributeId,
      mockSeed
    );
    expect(res.status).toBe(404);
  });

  it.each([
    {
      error: new ApiError({
        code: "eServiceNotFound",
        title: "EService not found",
        detail: "EService not found",
      }),
      status: 404,
    },
    {
      error: new ApiError({
        code: "eServiceDescriptorNotFound",
        title: "EService descriptor not found",
        detail: "EService descriptor not found",
      }),
      status: 404,
    },
    {
      error: new ApiError({
        code: "attributeNotFound",
        title: "Attribute not found",
        detail: "Attribute not found",
      }),
      status: 404,
    },
    {
      error: new ApiError({
        code: "certifiedAttributeGroupNotFoundInSeed",
        title: "Certified attribute group not found in seed",
        detail: "Certified attribute group not found in seed",
      }),
      status: 404,
    },
    {
      error: new ApiError({
        code: "notValidDescriptor",
        title: "Not valid descriptor",
        detail: "Not valid descriptor",
      }),
      status: 400,
    },
    {
      error: new ApiError({
        code: "templateInstanceNotAllowed",
        title: "Template instance not allowed",
        detail: "Template instance not allowed",
      }),
      status: 400,
    },
    {
      error: new ApiError({
        code: "inconsistentDailyCalls",
        title: "Inconsistent daily calls",
        detail: "Inconsistent daily calls",
      }),
      status: 400,
    },
    {
      error: new ApiError({
        code: "unchangedAttributes",
        title: "Unchanged attributes",
        detail: "Unchanged attributes",
      }),
      status: 409,
    },
    {
      error: new ApiError({
        code: "operationForbidden",
        title: "Operation forbidden",
        detail: "Operation forbidden",
      }),
      status: 403,
    },
  ])(
    "Should return $status for mapped catalog-process error $error.code",
    async ({ error, status }) => {
      mockEserviceService.updateEServiceDescriptorCertifiedAttributeInGroup = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        0,
        generateId(),
        mockSeed
      );
      expect(res.status).toBe(status);
    }
  );
});
