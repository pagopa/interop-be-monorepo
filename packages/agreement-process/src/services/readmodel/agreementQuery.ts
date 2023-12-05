import { Agreement, ListResult, WithMetadata } from "pagopa-interop-models";
import { AgreementQueryFilters, ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementQueryBuilder(readModelService: ReadModelService) {
  return {
    getAgreementById: async (
      id: string
    ): Promise<WithMetadata<Agreement> | undefined> =>
      await readModelService.readAgreementById(id),
    getAgreements: (
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> =>
      readModelService.getAgreements(filters),
    listAgreements: (
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> =>
      readModelService.listAgreements(filters, limit, offset),
  };
}

export type AgreementQuery = ReturnType<typeof agreementQueryBuilder>;
