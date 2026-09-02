/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiRejectDelegatedDescriptorArchivingSeed } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/rejectDelegatedArchiving", () => {
  const mockRejectDelegatedDescriptorArchivingSeed =
    getMockBffApiRejectDelegatedDescriptorArchivingSeed();

  beforeEach(() => {
    clients.catalogProcessClient.rejectDelegatedDescriptorArchiving = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    body: bffApi.RejectDelegatedDescriptorArchivingSeed = mockRejectDelegatedDescriptorArchivingSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/rejectDelegatedArchiving`
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
    {
      body: { ...mockRejectDelegatedDescriptorArchivingSeed, extraField: 1 },
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as bffApi.RejectDelegatedDescriptorArchivingSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
