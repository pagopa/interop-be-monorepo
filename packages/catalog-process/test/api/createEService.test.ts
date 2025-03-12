import { describe, it, vi } from "vitest";
import request from "supertest";
import {
  getMockEService,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { match } from "ts-pattern";
import {
  buildDescriptorSeedForEserviceCreation,
  getMockDescriptor,
} from "../mockUtils.js";
import { api } from "../vitest.api.setup.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";

describe("api create eservice", () => {
  const mockEService = getMockEService();

  vi.spyOn(catalogService, "createEService").mockImplementation(() =>
    Promise.resolve(mockEService)
  );

  it("should write on event-store for the creation of an eservice", async () => {
    const mockDescriptor = getMockDescriptor();
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable = randomArrayItem([false, true, undefined]);
    const isClientAccessDelegable = match(isConsumerDelegable)
      .with(undefined, () => undefined)
      .with(true, () => randomArrayItem([false, true, undefined]))
      .with(false, () => false)
      .exhaustive();

    await request(api)
      .post("/eservices")
      .set("X-Correlation-Id", "79eb4963-3866-422f-8ef0-87871e5f9a71")
      .send({
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
        isConsumerDelegable,
        isClientAccessDelegable,
      })
      .expect(200);
  });
});
