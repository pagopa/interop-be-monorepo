/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test/index.js";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /eservices/:eServiceId/descriptors/:descriptorId", () => {
  const descriptor1 = getMockedApiEserviceDescriptor({ state: "DRAFT" });
  const descriptor2 = getMockedApiEserviceDescriptor({ state: "PUBLISHED" });
  const eservice = getMockedApiEservice({
    descriptors: [descriptor1, descriptor2],
  });

  beforeEach(() => {
    clients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue(eservice);
    clients.catalogProcessClient.deleteDraft = vi
      .fn()
      .mockResolvedValue(undefined);
    clients.catalogProcessClient.deleteEService = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 and delete the descriptor if it is not the last one", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      eservice.id as EServiceId,
      descriptor1.id as DescriptorId
    );
    expect(res.status).toBe(204);
    expect(clients.catalogProcessClient.deleteDraft).toHaveBeenCalled();
    expect(clients.catalogProcessClient.deleteEService).not.toHaveBeenCalled();
  });

  it("Should return 204 and delete the eservice if the descriptor is the last one and is a draft", async () => {
    clients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue({ ...eservice, descriptors: [descriptor1] });

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      eservice.id as EServiceId,
      descriptor1.id as DescriptorId
    );
    expect(res.status).toBe(204);
    expect(clients.catalogProcessClient.deleteEService).toHaveBeenCalled();
    expect(clients.catalogProcessClient.deleteDraft).not.toHaveBeenCalled();
  });

  it("Should call the descriptor deletion and propagate the process error if the last descriptor is not a draft", async () => {
    clients.catalogProcessClient.getEServiceById = vi
      .fn()
      .mockResolvedValue({ ...eservice, descriptors: [descriptor2] });

    const upstreamError = new AxiosError(
      "upstream error",
      "400",
      undefined,
      undefined,
      {
        status: 400,
        data: {
          type: "about:blank",
          title: "Not valid descriptor state",
          status: 400,
          detail: "upstream error detail",
          correlationId: "test-correlation-id",
          errors: [{ code: "005-0004", detail: "upstream error detail" }],
        },
        statusText: "",
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );
    clients.catalogProcessClient.deleteDraft = vi
      .fn()
      .mockRejectedValue(upstreamError);

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      eservice.id as EServiceId,
      descriptor2.id as DescriptorId
    );
    expect(res.status).toBe(400);
    expect(clients.catalogProcessClient.deleteDraft).toHaveBeenCalled();
    expect(clients.catalogProcessClient.deleteEService).not.toHaveBeenCalled();
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, descriptorId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId, descriptorId);
      expect(res.status).toBe(400);
    }
  );
});
