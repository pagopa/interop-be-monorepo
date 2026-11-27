/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API PATCH /purposes/:purposeId", () => {
  const purpose = getMockedApiPurpose();
  const seed: bffApi.PatchPurposeUpdateContent = {
    title: "updated title",
    description: "updated description",
    isFreeOfCharge: false,
    freeOfChargeReason: null,
    dailyCalls: 99,
    riskAnalysisForm: { version: "3.0", answers: {} },
  };

  beforeEach(() => {
    clients.purposeProcessClient.patchUpdatePurpose = vi
      .fn()
      .mockResolvedValue(purpose);
  });

  const makeRequest = (body: object = seed, id: string = purpose.id) =>
    request(api)
      .patch(`${appBasePath}/purposes/${id}`)
      .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it.each([
    seed,
    { title: "updated title" },
    { description: "updated description" },
    { freeOfChargeReason: null },
    { title: "a".repeat(5), description: "a".repeat(10) },
    { title: "a".repeat(60), description: "a".repeat(250) },
  ])(
    "forwards one complete or partial command %# without adding fields",
    async (body) => {
      const res = await makeRequest(body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: purpose.id });
      expect(
        clients.purposeProcessClient.patchUpdatePurpose
      ).toHaveBeenCalledExactlyOnceWith(body, {
        headers: expect.any(Object),
        params: { id: purpose.id },
      });
    }
  );

  it.each([
    {},
    { title: null },
    { title: 123 },
    { title: "a".repeat(4) },
    { title: "a".repeat(61) },
    { description: null },
    { description: "a".repeat(9) },
    { description: "a".repeat(251) },
    { dailyCalls: 0 },
    { dailyCalls: 1000000001 },
    { riskAnalysisForm: {} },
    { ...seed, extraField: true },
  ])("rejects invalid body %# before calling the process", async (body) => {
    const res = await makeRequest(body);
    expect(res.status).toBe(400);
    expect(
      clients.purposeProcessClient.patchUpdatePurpose
    ).not.toHaveBeenCalled();
  });

  it("rejects invalid ids before calling the process", async () => {
    const res = await makeRequest(seed, "invalid");
    expect(res.status).toBe(400);
    expect(
      clients.purposeProcessClient.patchUpdatePurpose
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "propagates process status %s without retrying",
    async (status) => {
      const problem = {
        type: "about:blank",
        title: "Purpose update failed",
        status,
        detail: "Purpose update failed",
        errors: [{ code: "004-0001", detail: "Purpose update failed" }],
      };
      clients.purposeProcessClient.patchUpdatePurpose = vi
        .fn()
        .mockRejectedValue(
          new AxiosError(
            "Purpose update failed",
            undefined,
            undefined,
            undefined,
            {
              status,
              data: problem,
              statusText: "Purpose update failed",
              config: {} as InternalAxiosRequestConfig,
              headers: {},
            }
          )
        );
      const res = await makeRequest();
      expect(res.status).toBe(status);
      expect(res.body.errors).toEqual(problem.errors);
      expect(
        clients.purposeProcessClient.patchUpdatePurpose
      ).toHaveBeenCalledTimes(1);
    }
  );

  it("rejects an invalid process response", async () => {
    clients.purposeProcessClient.patchUpdatePurpose = vi
      .fn()
      .mockResolvedValue({ id: "invalid" });
    const res = await makeRequest();
    expect(res.status).toBe(500);
  });
});
