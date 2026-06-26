import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId, Problem, PurposeTemplateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";
import { AxiosError, InternalAxiosRequestConfig } from "axios";

describe("API POST /purposeTemplates/{purposeTemplateId}/archive", () => {
  const mockArchivedPurposeTemplateId = generateId<PurposeTemplateId>();

  beforeEach(() => {
    clients.purposeTemplateProcessClient.archivePurposeTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId
  ): Promise<request.Response> =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${purposeTemplateId}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockArchivedPurposeTemplateId);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("Should return 400 for invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });

  it("Should return 500 when the downstream archive endpoint returns an unexpected error", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const downstreamProblem: Problem = {
      type: "about:blank",
      title: "Unexpected error",
      status: 500,
      detail: "Unexpected error",
      correlationId: "test-correlation-id",
      errors: [{ code: "015-9991", detail: "Unexpected error" }],
    };

    clients.purposeTemplateProcessClient.archivePurposeTemplate = vi
      .fn()
      .mockRejectedValue(
        new AxiosError("Unexpected error", "500", undefined, undefined, {
          status: 500,
          data: downstreamProblem,
          statusText: "Internal Server Error",
          config: {} as InternalAxiosRequestConfig,
          headers: {},
        })
      );

    const res = await makeRequest(token, mockArchivedPurposeTemplateId);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      title: downstreamProblem.title,
      status: downstreamProblem.status,
      detail: downstreamProblem.detail,
      errors: [{ code: "008-9991", detail: downstreamProblem.detail }],
    });
  });
});
