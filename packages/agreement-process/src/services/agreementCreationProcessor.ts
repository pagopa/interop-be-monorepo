import { AuthData, CreateEvent, logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  agreementState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { toCreateEventAgreementAdded } from "../model/domain/toEvent.js";
import {
  assertEServiceExist,
  assertTenantExist,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  verifyCreationConflictingAgreements,
} from "../model/domain/validators.js";
import { ApiAgreementPayload } from "../model/types.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

// eslint-disable-next-line max-params
export async function createAgreementLogic(
  agreement: ApiAgreementPayload,
  authData: AuthData,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery
): Promise<CreateEvent<AgreementEvent>> {
  logger.info(
    `Creating agreement for EService ${agreement.eserviceId} and Descriptor ${agreement.descriptorId}`
  );
  const eservice = await eserviceQuery.getEServiceById(agreement.eserviceId);
  assertEServiceExist(unsafeBrandId(agreement.eserviceId), eservice);

  const descriptor = validateCreationOnDescriptor(
    eservice.data,
    unsafeBrandId(agreement.descriptorId)
  );

  await verifyCreationConflictingAgreements(
    authData.organizationId,
    agreement,
    agreementQuery
  );
  const consumer = await tenantQuery.getTenantById(authData.organizationId);
  assertTenantExist(authData.organizationId, consumer);

  if (eservice.data.producerId !== consumer.data.id) {
    validateCertifiedAttributes(descriptor, consumer.data);
  }

  const agreementSeed: Agreement = {
    id: generateId(),
    eserviceId: unsafeBrandId(agreement.eserviceId),
    descriptorId: unsafeBrandId(agreement.descriptorId),
    producerId: eservice.data.producerId,
    consumerId: authData.organizationId,
    state: agreementState.draft,
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    createdAt: new Date(),
    stamps: {},
  };

  return toCreateEventAgreementAdded(agreementSeed);
}
