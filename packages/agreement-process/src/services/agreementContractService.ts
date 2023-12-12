/* eslint-disable max-params */
import {
  Agreement,
  EService,
  Tenant,
  UpdateAgreementSeed,
} from "pagopa-interop-models";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { tenantIdNotFound } from "../model/domain/errors.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { ContractBuilder } from "./agreementContractBuilder.js";

export const addContract =
  (
    addContract: (
      agreementId: string,
      seed: ApiAgreementDocumentSeed
    ) => Promise<void>
  ): ((
    agreement: Agreement,
    eservice: EService,
    consumer: Tenant,
    seed: UpdateAgreementSeed,
    tenantQuery: TenantQuery,
    constractBuilder: ContractBuilder
  ) => Promise<void>) =>
  async (
    agreement: Agreement,
    eservice: EService,
    consumer: Tenant,
    seed: UpdateAgreementSeed,
    tenantQuery: TenantQuery,
    constractBuilder: ContractBuilder
  ): Promise<void> => {
    const producer = await tenantQuery.getTenantById(agreement.consumerId);

    if (!producer?.data) {
      throw tenantIdNotFound(500, agreement.consumerId);
    }

    const agreementdocumentSeed = await constractBuilder.createContract(
      agreement,
      eservice,
      consumer,
      producer.data,
      seed
    );

    await addContract(agreement.id, agreementdocumentSeed);
  };
