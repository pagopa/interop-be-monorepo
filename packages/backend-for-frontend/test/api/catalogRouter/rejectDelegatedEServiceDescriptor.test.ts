/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiRejectDelegatedEServiceDescriptorSeed } from "../../mockUtils.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/reject", () => {
  const mockRejectDelegatedEServiceDescriptorSeed =
    getMockBffApiRejectDelegatedEServiceDescriptorSeed();

  beforeEach(() => {
    clients.catalogProcessClient.rejectDelegatedEServiceDescriptor = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    body: bffApi.RejectDelegatedEServiceDescriptorSeed = mockRejectDelegatedEServiceDescriptorSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/reject`
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
    { body: { ...mockRejectDelegatedEServiceDescriptorSeed, extraField: 1 } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as bffApi.RejectDelegatedEServiceDescriptorSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
