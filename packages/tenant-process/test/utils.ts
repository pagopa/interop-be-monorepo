import {
  AgreementCollection,
  AttributeCollection,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  Agreement,
  Attribute,
  CertifiedTenantAttribute,
  EService,
  Tenant,
  TenantEvent,
  TenantEventV2,
  TenantId,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  generateId,
  tenantAttributeType,
  toReadModelAttribute,
  toReadModelEService,
  toReadModelAgreement,
  toTenantV2,
  EServiceId,
  DescriptorId,
  agreementState,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";

export const writeTenantInEventstore = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const tenantEvent: TenantEventV2 = {
    type: "TenantOnboarded",
    event_version: 2,
    data: { tenant: toTenantV2(tenant) },
  };
  const eventToWrite: StoredEvent<TenantEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: tenantEvent.data.tenant!.id,
    version: 0,
    event: tenantEvent,
  };
  await writeInEventstore(eventToWrite, "tenant", postgresDB);
};

export const currentDate = new Date();

export const getMockVerifiedBy = (): TenantVerifier => ({
  id: generateId(),
  verificationDate: currentDate,
});

export const getMockRevokedBy = (): TenantRevoker => ({
  id: generateId(),
  verificationDate: currentDate,
  revocationDate: currentDate,
});

export const getMockVerifiedTenantAttribute = (): VerifiedTenantAttribute => ({
  id: generateId(),
  type: tenantAttributeType.VERIFIED,
  assignmentTimestamp: new Date(),
  verifiedBy: [getMockVerifiedBy()],
  revokedBy: [getMockRevokedBy()],
});

export const getMockCertifiedTenantAttribute =
  (): CertifiedTenantAttribute => ({
    assignmentTimestamp: currentDate,
    id: generateId(),
    type: tenantAttributeType.CERTIFIED,
    revocationTimestamp: undefined,
  });

export const getMockAgreement = ({
  eserviceId,
  descriptorId,
  producerId,
  consumerId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  producerId: TenantId;
  consumerId: TenantId;
}): Agreement => ({
  id: generateId(),
  createdAt: new Date(),
  eserviceId,
  descriptorId,
  producerId,
  consumerId,
  state: agreementState.active,
  verifiedAttributes: [],
  certifiedAttributes: [],
  declaredAttributes: [],
  consumerDocuments: [],
  stamps: {
    submission: undefined,
    activation: undefined,
    rejection: undefined,
    suspensionByProducer: undefined,
    suspensionByConsumer: undefined,
    upgrade: undefined,
    archiving: undefined,
  },
});

export const addOneAgreement = async (
  agreement: Agreement,
  agreements: AgreementCollection
): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneEService = async (
  eservice: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneAttribute = async (
  attribute: Attribute,
  attributes: AttributeCollection
): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};

export const addOneTenant = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>,
  tenants: TenantCollection
): Promise<void> => {
  await writeTenantInEventstore(tenant, postgresDB);
  await writeInReadmodel(tenant, tenants);
};

export const readLastTenantEvent = async (
  tenantId: TenantId,
  postgresDB: IDatabase<unknown>
): Promise<ReadEvent<TenantEvent>> =>
  await readLastEventByStreamId(tenantId, "tenant", postgresDB);
