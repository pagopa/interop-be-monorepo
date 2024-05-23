import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";

export const { cleanup, readModelRepository } = setupTestContainersVitest(
  inject("readModelConfig")
);

export const agreements = readModelRepository.agreements;
afterEach(cleanup);
