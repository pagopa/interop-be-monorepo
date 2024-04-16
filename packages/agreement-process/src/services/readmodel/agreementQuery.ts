import {
  Agreement,
  AgreementId,
  ListResult,
  WithMetadata,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { CompactOrganization } from "../../model/domain/models.js";
import {
  AgreementEServicesQueryFilters,
  AgreementQueryFilters,
  ReadModelService,
} from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementQueryBuilder(readModelService: ReadModelService) {
  return {
    getAgreementById: async (
      id: AgreementId,
      logger: Logger
    ): Promise<WithMetadata<Agreement> | undefined> =>
      await readModelService.readAgreementById(id, logger),
    getAllAgreements: (
      filters: AgreementQueryFilters,
      logger: Logger
    ): Promise<Array<WithMetadata<Agreement>>> =>
      readModelService.getAllAgreements(filters, logger),
    getAgreements: (
      filters: AgreementQueryFilters,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<Agreement>> =>
      readModelService.getAgreements(filters, limit, offset, logger),
    getConsumers: (
      name: string | undefined,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactOrganization>> =>
      readModelService.listConsumers(name, limit, offset, logger),
    getProducers: (
      name: string | undefined,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactOrganization>> =>
      readModelService.listProducers(name, limit, offset, logger),
    getEServices: (
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactOrganization>> =>
      readModelService.listAgreementsEServices(filters, limit, offset, logger),
  };
}

export type AgreementQuery = ReturnType<typeof agreementQueryBuilder>;
