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
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";

describe("POST /purposeTemplates/:purposeTemplateId/eserviceTemplates route test", () => {
  const mockDate = new Date();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const mockRequestBody = {
    eserviceTemplateId: generateId<EServiceTemplateId>(),
  };

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId,
    body: m2mGatewayApiV3.PurposeTemplateLinkEServiceTemplate
  ) =>
    request(api)
      .post(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/eserviceTemplates`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      const purposeTemplateId = generateId<PurposeTemplateId>();
      mockPurposeTemplateService.addPurposeTemplateEServiceTemplate = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, purposeTemplateId, mockRequestBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(
        mockPurposeTemplateService.addPurposeTemplateEServiceTemplate
      ).toHaveBeenCalledWith(
        purposeTemplateId,
        mockRequestBody,
        expect.any(Object) // Context object
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockRequestBody);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for purpose template id", async () => {
    mockPurposeTemplateService.addPurposeTemplateEServiceTemplate = vi.fn();

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID" as PurposeTemplateId,
      mockRequestBody
    );
    expect(res.status).toBe(400);
  });

  it.each([
    {},
    { eserviceTemplateId: undefined },
    { eserviceTemplateId: "invalid-eservice-template-id" },
  ])("Should return 400 if passed an invalid request body", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      body as m2mGatewayApiV3.PurposeTemplateLinkEServiceTemplate
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
    mockPurposeTemplateService.addPurposeTemplateEServiceTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), mockRequestBody);

    expect(res.status).toBe(500);
  });
});
