/*
  IMPORTANT
  TODO: This is temporary attribute service for readmodel, it must be removed in favor 
  of developed service in this PR https://github.com/pagopa/interop-be-monorepo/pull/83
*/

import {
  Agreement,
  EService,
  Tenant,
  UpdateAgreementSeed,
} from "pagopa-interop-models";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { pdfGenerator } from "./pdfGenerator.js";

export const constractBuilder = {
  createContract: async (
    agreement: Agreement,
    eService: EService,
    consumer: Tenant,
    producer: Tenant,
    seed: UpdateAgreementSeed
  ): Promise<ApiAgreementDocumentSeed> =>
    await pdfGenerator.createDocumentSeed(
      agreement,
      eService,
      consumer,
      producer,
      seed
    ),
};

export type ContractBuilder = typeof constractBuilder;
