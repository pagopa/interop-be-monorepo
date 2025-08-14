/*
  addOnePurposeTemplate,
  purposeTemplateService,
  readLastPurposeTemplateEvent, */

import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { purposeTemplateReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { afterEach, inject } from "vitest";

export const { cleanup, readModelRepository, readModelDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const purposeTemplateReadModelServiceSQL =
  purposeTemplateReadModelServiceBuilder(readModelDB);

export const purposeTemplates = readModelRepository.purposeTemplates;
