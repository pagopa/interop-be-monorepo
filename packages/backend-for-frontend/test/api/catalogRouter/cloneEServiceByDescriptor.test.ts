/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockApiCreatedEServiceDescriptor } from "../../mockUtils.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/clone", () => {
  const mockEServiceId = generateId<EServiceId>();
  const mockDescriptorId = generateId<DescriptorId>();
  const mockApiCreatedEServiceDescriptor =
    getMockApiCreatedEServiceDescriptor();

  const makeRequest = async (
    token: string,
    descriptorId: unknown = mockDescriptorId
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${mockEServiceId}/descriptors/${descriptorId}/clone`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .field("kind", "DOCUMENT")
      .field("prettyName", "prettyName")
      .attach("doc", Buffer.from("content"), { filename: "doc.txt" });

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

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
