/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { eserviceDescriptorNotFound } from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /eservices/{eServiceId}/descriptors/{descriptorId}/verifiedAttributes router test", () => {
  const mockDescriptorAttributes: m2mGatewayApi.EServiceDescriptorAttributes = {
    attributes: [
      [{ id: generateId() }],
      [{ id: generateId() }, { id: generateId() }],
    ],
  };

  mockEserviceService.getEserviceDescriptorVerifiedAttributes = vi
    .fn()
    .mockResolvedValue(mockDescriptorAttributes);

  const makeRequest = async (
    token: string,
    eserviceId: string = generateId(),
    descriptorId: string = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/verifiedAttributes`
      )
      .set("Authorization", `Bearer ${token}`)
      .query({ offset: 0, limit: 10 })
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockDescriptorAttributes);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });

  it("Should return 404 in case of eserviceDescriptorNotFound error", async () => {
    mockEserviceService.getEserviceDescriptorVerifiedAttributes = vi
      .fn()
      .mockRejectedValueOnce(
        eserviceDescriptorNotFound(generateId(), generateId())
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(404);
  });

  it.each([
    {
      attributes: [...mockDescriptorAttributes.attributes, [{ id: undefined }]],
    },
    {
      attributes: [...mockDescriptorAttributes.attributes, [{ id: "invalid" }]],
    },
    {
      attributes: [...mockDescriptorAttributes.attributes, [{}]],
    },
  ] as unknown as m2mGatewayApi.EServiceDescriptorAttributes[])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEserviceDescriptorVerifiedAttributes = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
