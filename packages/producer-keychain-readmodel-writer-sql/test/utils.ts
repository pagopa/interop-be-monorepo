import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { producerKeychainReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { inject, afterEach } from "vitest";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const producerKeychainReadModelService =
  producerKeychainReadModelServiceBuilder(readModelDB);
