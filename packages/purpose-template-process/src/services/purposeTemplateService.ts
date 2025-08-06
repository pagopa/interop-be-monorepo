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
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  purposeTemplateNameConflict,
  purposeTemplateNotFound,
} from "../model/domain/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { assertConsistentFreeOfCharge } from "./validators.js";

async function retrievePurposeTemplate(
  id: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<PurposeTemplate>> {
  const purposeTemplate = await readModelService.getPurposeTemplateById(id);
  if (!purposeTemplate) {
    throw purposeTemplateNotFound(id);
  }
  return purposeTemplate;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  _dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  // TODO : use it to write purpose template events in the event store
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const repository = eventRepository(dbInstance, purposeEventToBinaryDataV2);

  return {
    async createPurposeTemplate(
      seed: purposeTemplateApi.PurposeTemplateSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Creating purpose template`);

      assertConsistentFreeOfCharge(
        seed.purposeIsFreeOfCharge,
        seed.purposeFreeOfChargeReason
      );

      const templateNameAlreadyExists =
        await readModelService.purposeTemplateNameConflict(seed.purposeTitle);

      if (templateNameAlreadyExists) {
        throw purposeTemplateNameConflict();
      }

      return readModelService.createPurposeTemplate(id, ctx);
    },
    async getPurposeTemplateById(
      id: PurposeTemplateId,
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Retrieving purpose template ${id}`);
      return retrievePurposeTemplate(id, readModelService);
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
