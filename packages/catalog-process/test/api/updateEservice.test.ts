/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
} from "pagopa-interop-models";
import { generateToken, randomArrayItem } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId} authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.draft,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
  const isConsumerDelegable = randomArrayItem([false, true, undefined]);
  const isClientAccessDelegable = match(isConsumerDelegable)
    .with(undefined, () => undefined)
    .with(true, () => randomArrayItem([false, true, undefined]))
    .with(false, () => false)
    .exhaustive();

  const eserviceSeed: catalogApi.UpdateEServiceSeed = {
    name: "new Name",
    description: mockEService.description,
    technology: "REST",
    mode: "DELIVER",
    isSignalHubEnabled,
    isConsumerDelegable,
    isClientAccessDelegable,
  };

  catalogService.updateEService = vi.fn().mockResolvedValue(mockEService);

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .put(`/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(eserviceSeed);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "");
    expect(res.status).toBe(404);
  });
});
