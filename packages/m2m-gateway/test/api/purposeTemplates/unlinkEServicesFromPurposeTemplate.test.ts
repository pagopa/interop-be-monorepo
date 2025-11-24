/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  pollingMaxRetriesExceeded,
  PurposeTemplateId,
} from "pagopa-interop-models";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";

describe("POST /purposeTemplates/:purposeTemplateId/unlinkEservices route test", () => {
  const mockDate = new Date();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const purposeTemplateId = generateId<PurposeTemplateId>();
  const mockEserviceIds = [generateId<EServiceId>()];

  const mockRequestBody = {
    eserviceIds: mockEserviceIds,
  };

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId,
    body: {
      eserviceIds: string[];
    }
  ) =>
    request(api)
      .post(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/unlinkEservices`
      )
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.unlinkEServicesFromPurposeTemplate = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, purposeTemplateId, mockRequestBody);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    mockPurposeTemplateService.unlinkEServicesFromPurposeTemplate = vi.fn();

    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockRequestBody);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for purpose template id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID" as PurposeTemplateId,
      mockRequestBody
    );
    expect(res.status).toBe(400);
  });

  it.each([{}, { eserviceIds: [] }])(
    "Should return 400 if passed an invalid request body",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        body as {
          eserviceIds: string[];
        }
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeTemplateService.unlinkEServicesFromPurposeTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), mockRequestBody);

    expect(res.status).toBe(500);
  });
});
