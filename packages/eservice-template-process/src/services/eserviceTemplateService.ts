/* eslint-disable @typescript-eslint/no-unused-vars */

import { DB, FileManager, eventRepository } from "pagopa-interop-commons";
import { eserviceTemplateEventToBinaryDataV2 } from "pagopa-interop-models";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  dbInstance: DB,
  _readModelService: ReadModelService,
  _fileManager: FileManager
) {
  const repository = eventRepository(
    dbInstance,
    eserviceTemplateEventToBinaryDataV2
  );
  void repository;
  return {};
}

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;
