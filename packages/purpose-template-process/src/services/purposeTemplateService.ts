import {
  PurposeTemplate,
  PurposeTemplateId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  AppContext,
  DB,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  _dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  // TODO : use it to write purpose template events in the event store
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const repository = eventRepository(dbInstance, purposeEventToBinaryDataV2);

  return {
    async getPurposeTemplateById(
      id: PurposeTemplateId,
      _ctx: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return readModelService.getPurposeTemplateById(id);
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
