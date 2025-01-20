/* eslint-disable max-params */
import {
  DB,
  FileManager,
  eventRepository,
} from "pagopa-interop-commons";
import { eserviceTemplateEventToBinaryData } from "pagopa-interop-models";
import { ReadModelService } from "./readModelService.js";


// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  dbInstance: DB,
  _readModelService: ReadModelService,
  _fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, eserviceTemplateEventToBinaryData);
  return {};
}



export type EServiceTemplateService = ReturnType<typeof eserviceTemplateServiceBuilder>;
