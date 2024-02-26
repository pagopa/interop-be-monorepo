import {
  AgreementCollection,
  AttributeCollection,
  AuthData,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  Agreement,
  Attribute,
  CertifiedTenantAttribute,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantId,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  agreementState,
  descriptorState,
  generateId,
  technology,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import { toTenantV1 } from "../src/model/domain/toEvent.js";

export const writeTenantInReadmodel = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await tenants.insertOne({
    data: tenant,
    metadata: {
      version: 0,
    },
  });
};

export const writeTenantInEventstore = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const tenantEvent: TenantEvent = {
    type: "TenantCreated",
    data: { tenant: toTenantV1(tenant) },
  };
  const eventToWrite = {
    stream_id: tenantEvent.data.tenant?.id,
    version: 0,
    type: tenantEvent.type,
    data: Buffer.from(tenantEventToBinaryData(tenantEvent)),
  };
  await postgresDB.none(
    "INSERT INTO tenant.events(stream_id, version, type, data) VALUES ($1, $2, $3, $4)",
    [
      eventToWrite.stream_id,
      eventToWrite.version,
      eventToWrite.type,
      eventToWrite.data,
    ]
  );
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
  type: "verified",
  assignmentTimestamp: new Date(),
  verifiedBy: [getMockVerifiedBy()],
  revokedBy: [getMockRevokedBy()],
});

export const getMockCertifiedTenantAttribute =
  (): CertifiedTenantAttribute => ({
    assignmentTimestamp: currentDate,
    id: generateId(),
    type: "certified",
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

export const writeAgreementInReadmodel = async (
  agreement: Agreement,
  agreements: AgreementCollection
): Promise<void> => {
  await agreements.insertOne({
    data: agreement,
    metadata: {
      version: 0,
    },
  });
};

export const writeEServiceInReadmodel = async (
  eService: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await eservices.insertOne({
    data: eService,
    metadata: {
      version: 0,
    },
  });
};

export const addOneAgreement = async (
  agreement: Agreement,
  agreements: AgreementCollection
): Promise<void> => {
  await writeAgreementInReadmodel(agreement, agreements);
};

export const addOneEService = async (
  eService: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await writeEServiceInReadmodel(eService, eservices);
};

export const addOneTenant = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>,
  tenants: TenantCollection
): Promise<void> => {
  await writeTenantInEventstore(tenant, postgresDB);
  await writeTenantInReadmodel(tenant, tenants);
};
