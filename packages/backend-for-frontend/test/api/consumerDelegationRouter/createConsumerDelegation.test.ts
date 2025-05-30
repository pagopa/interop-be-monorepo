/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiDelegationSeed,
  getMockDelegationApiDelegation,
} from "../../mockUtils.js";

describe("API POST /consumers/delegations", () => {
  const mockDelegationSeed = getMockBffApiDelegationSeed();
  const mockClientResponse = getMockDelegationApiDelegation();
  const mockCreatedResource = getMockBffApiCreatedResource(
    mockClientResponse.id
  );

  beforeEach(() => {
    clients.delegationProcessClient.consumer = {} as ReturnType<
      typeof delegationApi.createConsumerApiClient
    >;
    clients.delegationProcessClient.consumer.createConsumerDelegation = vi
      .fn()
      .mockResolvedValue(mockClientResponse);
  });

  const makeRequest = async (
    token: string,
    payload: object = mockDelegationSeed
  ) =>
    request(api)
      .post(`${appBasePath}/consumers/delegations`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it.each([
    { body: {} },
    { body: { ...mockDelegationSeed, delegateId: "invalid" } },
    { body: { ...mockDelegationSeed, eserviceId: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed invalid data", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {});
    expect(res.status).toBe(400);
  });
});
