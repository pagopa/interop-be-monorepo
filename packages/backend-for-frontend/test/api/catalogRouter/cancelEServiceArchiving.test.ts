/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /eservices/:eServiceId/scheduleArchive", () => {
  const eServiceId = "5497bf2b-168d-44d5-abce-35ac390f32d4" as EServiceId;

  beforeEach(() => {
    clients.catalogProcessClient.cancelScheduleArchiveEservice = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    requestEServiceId: EServiceId = eServiceId
  ) =>
    request(api)
      .delete(`${appBasePath}/eservices/${requestEServiceId}/scheduleArchive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it("Should return 400 if passed an invalid eServiceId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as EServiceId);
    expect(res.status).toBe(400);
  });
});
