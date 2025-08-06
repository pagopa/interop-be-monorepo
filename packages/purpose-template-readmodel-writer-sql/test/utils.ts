import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { purposeTemplateReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { purposeTemplateWriterServiceBuilder } from "../src/purposeTemplateWriterService.js";

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

export const purposeTemplateReadModelService =
  purposeTemplateReadModelServiceBuilder(readModelDB);
export const purposeTemplateWriterService =
  purposeTemplateWriterServiceBuilder(readModelDB);
