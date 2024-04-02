import {
  AgreementCollection,
  AuthData,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Tenant,
  TenantEvent,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  technology,
  tenantEventToBinaryData,
  toReadModelEService,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import { v4 as uuidv4 } from "uuid";
import {
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { toTenantV1 } from "../src/model/domain/toEvent.js";

export const writeTenantInEventstore = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const tenantEvent: TenantEvent = {
    type: "TenantCreated",
    event_version: 1,
    data: { tenant: toTenantV1(tenant) },
  };
  const eventToWrite = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: tenantEvent.data.tenant!.id,
    version: "0",
    type: tenantEvent.type,
    event_version: tenantEvent.event_version,
    data: tenantEventToBinaryData(tenantEvent),
  };

  await writeInEventstore(eventToWrite, "tenant", postgresDB);
};

export const getMockTenant = (): Tenant => ({
  name: "A tenant",
  id: generateId(),
  createdAt: new Date(),
  attributes: [],
  selfcareId: uuidv4(),
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  features: [],
  mails: [],
});

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
  userId: uuidv4(),
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
  eServiceId,
  descriptorId,
  producerId,
  consumerId,
}: {
  eServiceId: EServiceId;
  descriptorId: DescriptorId;
  producerId: TenantId;
  consumerId: TenantId;
}): Agreement => ({
  id: generateId(),
  createdAt: new Date(),
  eserviceId: eServiceId,
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
