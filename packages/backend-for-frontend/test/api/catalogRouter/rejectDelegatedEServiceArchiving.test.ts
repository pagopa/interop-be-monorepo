/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /eservices/:eServiceId/rejectDelegatedArchiving", () => {
  beforeEach(() => {
    clients.catalogProcessClient.rejectDelegatedEServiceArchiving = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const mockRejectReasonSeed: bffApi.RejectDelegatedEServiceArchivingSeed = {
    rejectionReason: "Rejection reason",
  };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    body: bffApi.RejectDelegatedEServiceArchivingSeed = mockRejectReasonSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/rejectDelegatedArchiving`)
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
      rejectionReason: mockRejectReasonSeed.rejectionReason,
    },
    {
      eServiceId: generateId<EServiceId>(),
      rejectionReason: "",
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, rejectionReason }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId, {
        rejectionReason,
      });
      expect(res.status).toBe(400);
    }
  );
});
