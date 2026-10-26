/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /eservices/:eServiceId/consumers", () => {
  const mockResponse = {
    filename: "name",
    file: Buffer.from("contents"),
  };

  beforeEach(() => {
    services.catalogService.getEServiceConsumers = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/eservices/${eServiceId}/consumers`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse.file);
    expect(res.headers["content-disposition"]).toBe(
      "attachment; filename=name"
    );
  });

  it("Should encode Unicode filenames in Content-Disposition", async () => {
    services.catalogService.getEServiceConsumers = vi.fn().mockResolvedValue({
      ...mockResponse,
      filename: "PCP – CodeList.csv",
    });

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe(
      "attachment; filename=\"PCP ? CodeList.csv\"; filename*=UTF-8''PCP%20%E2%80%93%20CodeList.csv"
    );
  });

  it("Should keep CR/LF and quotes safe in Content-Disposition", async () => {
    services.catalogService.getEServiceConsumers = vi.fn().mockResolvedValue({
      ...mockResponse,
      filename: 'report"\r\ninvalid.pdf',
    });

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    const contentDisposition = res.headers["content-disposition"] as string;

    expect(res.status).toBe(200);
    expect(contentDisposition).not.toMatch(/[\r\n]/);
    expect(contentDisposition).toContain("%0D%0A");
    expect(contentDisposition).toContain('report\\"??invalid.pdf');
  });

  it("Should replace path separators in filenames", async () => {
    services.catalogService.getEServiceConsumers = vi.fn().mockResolvedValue({
      ...mockResponse,
      filename: "../folder\\report.pdf",
    });

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe(
      "attachment; filename=.._folder_report.pdf"
    );
  });

  it.each([
    {
      error: eserviceRiskNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(generateId(), generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.getEServiceConsumers = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid eServiceId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as EServiceId);
    expect(res.status).toBe(400);
  });
});
