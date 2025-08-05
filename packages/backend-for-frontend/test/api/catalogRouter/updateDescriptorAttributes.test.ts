/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiDescriptorAttributesSeed } from "../../mockUtils.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/attributes/update", () => {
  const mockDescriptorAttributesSeed = getMockBffApiDescriptorAttributesSeed();

  beforeEach(() => {
    clients.catalogProcessClient.updateDescriptorAttributes = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    body: bffApi.DescriptorAttributesSeed = mockDescriptorAttributesSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/attributes/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
    { body: {} },
    { body: { ...mockDescriptorAttributesSeed, extraField: 1 } },
    { body: { ...mockDescriptorAttributesSeed, certified: "invalid" } },
    { body: { ...mockDescriptorAttributesSeed, certified: ["invalid"] } },
    { body: { ...mockDescriptorAttributesSeed, declared: "invalid" } },
    { body: { ...mockDescriptorAttributesSeed, declared: ["invalid"] } },
    { body: { ...mockDescriptorAttributesSeed, verified: "invalid" } },
    { body: { ...mockDescriptorAttributesSeed, verified: ["invalid"] } },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as bffApi.DescriptorAttributesSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
