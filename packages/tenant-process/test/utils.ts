import {
  AgreementCollection,
  AttributeCollection,
  AuthData,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  writeInEventstore,
  writeInReadmodel,
  StoredEvent,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  Attribute,
  CertifiedTenantAttribute,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Tenant,
  TenantEventV2,
  TenantId,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  agreementState,
  descriptorState,
  generateId,
  technology,
  tenantAttributeType,
  tenantEventToBinaryDataV2,
  toReadModelAttribute,
  toReadModelEService,
  toTenantV2,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";

export const writeTenantInEventstore = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const tenantEvent: TenantEventV2 = {
    type: "TenantOnboarded",
    event_version: 2,
    data: { tenant: toTenantV2(tenant) },
  };
  const eventToWrite = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: tenantEvent.data.tenant!.id,
    version: "0",
    type: tenantEvent.type,
    event_version: tenantEvent.event_version,
    data: Buffer.from(tenantEventToBinaryDataV2(tenantEvent)),
  };
  await writeInEventstore(eventToWrite, "tenant", postgresDB);
};

export const getMockTenant = (): Tenant => ({
  name: "A tenant",
  id: generateId(),
  createdAt: new Date(),
  attributes: [],
  selfcareId: generateId(),
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  features: [],
  mails: [],
});

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
    revocationTimestamp: currentDate,
  });

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
  userId: generateId(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
});

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
  riskAnalysis: [],
  mode: "Deliver",
});

export const getMockDescriptor = (): Descriptor => ({
  id: generateId(),
  version: "0",
  docs: [],
  state: descriptorState.draft,
  audience: [],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: [],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
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
  await writeInReadmodel(agreement, agreements);
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
): Promise<StoredEvent> =>
  await readLastEventByStreamId(tenantId, "tenant", postgresDB);
