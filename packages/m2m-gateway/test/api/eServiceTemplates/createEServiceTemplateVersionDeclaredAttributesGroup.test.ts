import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
  getMockedApiAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  eserviceTemplateApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { eserviceTemplateVersionNotFound } from "../../../src/model/errors.js";
import { toM2MGatewayApiDeclaredAttribute } from "../../../src/api/attributeApiConverter.js";

describe("POST /eserviceTemplates/:templateId/versions/:versionId/declaredAttributes/groups router test", () => {
  const mockTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();
  const mockVersion = mockTemplate.versions[0]!;

  const mockAttributeSeed: m2mGatewayApi.EServiceDescriptorAttributesGroupSeed =
    {
      attributeIds: [generateId(), generateId(), generateId()],
    };

  const mockAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
  });
  const mockAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
  });

  const mockResponse: m2mGatewayApi.EServiceTemplateVersionDeclaredAttributesGroup =
    {
      attributes: [
        {
          groupIndex: 1,
          attribute: toM2MGatewayApiDeclaredAttribute({
            attribute: mockAttribute1,
            logger: genericLogger,
          }),
        },
        {
          groupIndex: 1,
          attribute: toM2MGatewayApiDeclaredAttribute({
            attribute: mockAttribute2,
            logger: genericLogger,
          }),
        },
      ],
    };

  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string,
    body: m2mGatewayApi.EServiceDescriptorAttributesGroupSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/declaredAttributes/groups`
      )
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 201 and create declared attributes group for user with role %s",
    async (role) => {
      mockEServiceTemplateService.createEServiceTemplateVersionDeclaredAttributesGroup =
        vi.fn().mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockTemplate.id,
        mockVersion.id,
        mockAttributeSeed
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockResponse);
      expect(
        mockEServiceTemplateService.createEServiceTemplateVersionDeclaredAttributesGroup
      ).toHaveBeenCalledWith(
        unsafeBrandId(mockTemplate.id),
        unsafeBrandId(mockVersion.id),
        mockAttributeSeed,
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
      mockTemplate.id,
      mockVersion.id,
      mockAttributeSeed
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed invalid attribute IDs", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const invalidBody = { attributeIds: ["not-a-uuid", "also-invalid"] };
    const res = await makeRequest(
      token,
      mockTemplate.id,
      mockVersion.id,
      invalidBody
    );

    expect(res.status).toBe(400);
  });

  it("Should return 404 if version not found", async () => {
    const nonExistentVersionId = generateId();
    mockEServiceTemplateService.createEServiceTemplateVersionDeclaredAttributesGroup =
      vi
        .fn()
        .mockRejectedValue(
          eserviceTemplateVersionNotFound(
            unsafeBrandId(mockTemplate.id),
            unsafeBrandId(nonExistentVersionId)
          )
        );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockTemplate.id,
      nonExistentVersionId,
      mockAttributeSeed
    );

    expect(res.status).toBe(404);
  });
});
