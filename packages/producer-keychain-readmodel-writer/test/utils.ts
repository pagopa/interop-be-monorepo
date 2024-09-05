import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

export const producerKeychains = readModelRepository.producerKeychains;
