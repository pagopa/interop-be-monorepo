/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import {
  EServiceTemplateId,
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

describe("DELETE /purposeTemplates/:purposeTemplateId/eserviceTemplates/:eserviceTemplateId route test", () => {
  const mockDate = new Date();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const purposeTemplateId = generateId<PurposeTemplateId>();
  const mockEserviceTemplateId = generateId<EServiceTemplateId>();

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId,
    eserviceTemplateId: EServiceTemplateId
  ) =>
    request(api)
      .delete(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/eserviceTemplates/${eserviceTemplateId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.removePurposeTemplateEServiceTemplate =
        vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        mockEserviceTemplateId
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    mockPurposeTemplateService.removePurposeTemplateEServiceTemplate = vi.fn();

    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockEserviceTemplateId);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for purpose template id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID" as PurposeTemplateId,
      mockEserviceTemplateId
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for eservice template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      "INVALID ID" as EServiceTemplateId
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeTemplateService.removePurposeTemplateEServiceTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), mockEserviceTemplateId);

    expect(res.status).toBe(500);
  });
});
