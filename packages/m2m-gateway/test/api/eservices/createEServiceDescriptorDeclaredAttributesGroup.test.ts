import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  catalogApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { eserviceDescriptorNotFound } from "../../../src/model/errors.js";
import { toM2MGatewayApiDeclaredAttribute } from "../../../src/api/attributeApiConverter.js";

describe("POST /eservices/:eserviceId/descriptors/:descriptorId/declaredAttributes/groups router test", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockDescriptor = mockEService.descriptors[0]!;

  const mockAttributeIds = [generateId(), generateId()];

  const mockAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
  });
  const mockAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
  });

  const mockResponse: m2mGatewayApi.EServiceDescriptorDeclaredAttribute[] = [
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiDeclaredAttribute({
        attribute: mockAttribute1,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiDeclaredAttribute({
        attribute: mockAttribute2,
        logger: genericLogger,
      }),
    },
  ];

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string,
    body: string[]
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/declaredAttributes/groups`
      )
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and create declared attributes group for user with role %s",
    async (role) => {
      mockEserviceService.createEServiceDescriptorDeclaredAttributesGroup = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEService.id,
        mockDescriptor.id,
        mockAttributeIds
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockResponse);
      expect(
        mockEserviceService.createEServiceDescriptorDeclaredAttributesGroup
      ).toHaveBeenCalledWith(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockAttributeIds,
        expect.anything()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockEService.id,
      mockDescriptor.id,
      mockAttributeIds
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed invalid attribute IDs", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const invalidBody = ["not-a-uuid"];
    const res = await makeRequest(
      token,
      mockEService.id,
      mockDescriptor.id,
      invalidBody
    );

    expect(res.status).toBe(400);
  });

  it("Should return 404 if descriptor not found", async () => {
    const nonExistentDescriptorId = generateId();
    mockEserviceService.createEServiceDescriptorDeclaredAttributesGroup = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorNotFound(
          unsafeBrandId(mockEService.id),
          unsafeBrandId(nonExistentDescriptorId)
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      nonExistentDescriptorId,
      mockAttributeIds
    );

    expect(res.status).toBe(404);
  });
});
