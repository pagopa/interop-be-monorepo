/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /eservices/:eServiceId/approveDelegatedArchiving", () => {
  beforeEach(() => {
    clients.catalogProcessClient.approveDelegatedEServiceArchiving = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId()
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/approveDelegatedArchiving`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    {
      eServiceId: "invalidId" as EServiceId,
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId);
      expect(res.status).toBe(400);
    }
  );
});
