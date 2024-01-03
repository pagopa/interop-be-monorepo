import { Agreement, ListResult, WithMetadata } from "pagopa-interop-models";
import { CompactOrganization } from "../../model/domain/models.js";
import { AgreementQueryFilters, ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementQueryBuilder(readModelService: ReadModelService) {
  return {
    getAgreementById: async (
      id: string
    ): Promise<WithMetadata<Agreement> | undefined> =>
      await readModelService.readAgreementById(id),
    getAllAgreements: (
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> =>
      readModelService.getAllAgreements(filters),
    getAgreements: (
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> =>
      readModelService.getAgreements(filters, limit, offset),
    getConsumers: (
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> =>
      readModelService.listConsumers(name, limit, offset),
  };
}

export type AgreementQuery = ReturnType<typeof agreementQueryBuilder>;
