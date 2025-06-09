/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCreatedEServiceDescriptor } from "../../mockUtils.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/clone", () => {
  const mockApiCreatedEServiceDescriptor =
    getMockBffApiCreatedEServiceDescriptor();

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId()
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/clone`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    services.catalogService.cloneEServiceByDescriptor = vi
      .fn()
      .mockResolvedValue(mockApiCreatedEServiceDescriptor);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedEServiceDescriptor);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, descriptorId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId, descriptorId);
      expect(res.status).toBe(400);
    }
  );
});
