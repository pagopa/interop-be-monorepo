import { AuthData } from "pagopa-interop-commons";
import {
  Agreement,
  CertifiedTenantAttribute,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Tenant,
  TenantEvent,
  TenantId,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  agreementState,
  descriptorState,
  generateId,
  technology,
  tenantAttributeType,
  toReadModelEService,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { toTenantV1 } from "../src/model/domain/toEvent.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { tenantServiceBuilder } from "../src/services/tenantService.js";

export const { cleanup, readModelRepository, postgresDB } =
  setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const tenantService = tenantServiceBuilder(postgresDB, readModelService);

export const writeTenantInEventstore = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const tenantEvent: TenantEvent = {
    type: "TenantCreated",
    event_version: 1,
    data: { tenant: toTenantV1(tenant) },
  };
  const eventToWrite: StoredEvent<TenantEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: tenantEvent.data.tenant!.id,
    version: 0,
    event: tenantEvent,
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
  selfcareId: generateId(),
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

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeTenantInEventstore(tenant, postgresDB);
  await writeInReadmodel(tenant, tenants);
};

export const readLastTenantEvent = async (
  tenantId: TenantId
): Promise<ReadEvent<TenantEvent>> =>
  await readLastEventByStreamId(tenantId, "tenant", postgresDB);
