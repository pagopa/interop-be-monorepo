import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { producerJWKKeyReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { inject, afterEach } from "vitest";
import { customReadModelServiceBuilder } from "../src/readModelService.js";

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

export const producerJWKKeyReadModelService =
  producerJWKKeyReadModelServiceBuilder(readModelDB);
export const readModelService = customReadModelServiceBuilder(
  readModelDB,
  producerJWKKeyReadModelService
);
