/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/scheduleArchive", () => {
  beforeEach(() => {
    clients.catalogProcessClient.scheduleEServiceDescriptorArchiving = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const mockGracePeriodDaysSeed: catalogApi.GracePeriodDaysSeed = {
    gracePeriodDays: 30,
  };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    body: catalogApi.GracePeriodDaysSeed = mockGracePeriodDaysSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/scheduleArchive`
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
    {
      eServiceId: "invalid" as EServiceId,
      descriptorId: generateId<DescriptorId>(),
      gracePeriodDays: 30,
    },
    {
      eServiceId: generateId<EServiceId>(),
      descriptorId: "invalid" as DescriptorId,
      gracePeriodDays: 30,
    },
    {
      eServiceId: generateId<EServiceId>(),
      descriptorId: generateId<DescriptorId>(),
      gracePeriodDays: -1,
    },
    {
      eServiceId: generateId<EServiceId>(),
      descriptorId: generateId<DescriptorId>(),
      gracePeriodDays: 0,
    },
    {
      eServiceId: generateId<EServiceId>(),
      descriptorId: generateId<DescriptorId>(),
      gracePeriodDays: 29,
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, descriptorId, gracePeriodDays }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId, descriptorId, {
        gracePeriodDays: gracePeriodDays as catalogApi.GracePeriodDays,
      });
      expect(res.status).toBe(400);
    }
  );
});
