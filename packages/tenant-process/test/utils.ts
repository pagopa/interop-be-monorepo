import { AuthData } from "pagopa-interop-commons";
import {
  Agreement,
  CertifiedTenantAttribute,
  EService,
  Tenant,
  TenantEvent,
  TenantId,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  generateId,
  tenantAttributeType,
  toReadModelEService,
  toReadModelAgreement,
  toTenantV2,
  EServiceId,
  DescriptorId,
  agreementState,
} from "pagopa-interop-models";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { tenantServiceBuilder } from "../src/services/tenantService.js";

export const { cleanup, readModelRepository, postgresDB } =
  setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

export const { agreements, clients, eservices, attributes, tenants } =
  readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const tenantService = tenantServiceBuilder(postgresDB, readModelService);

export const writeTenantInEventstore = async (
  tenant: Tenant
): Promise<void> => {
  const tenantEvent: TenantEvent = {
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

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeTenantInEventstore(tenant);
  await writeInReadmodel(tenant, tenants);
};

export const readLastTenantEvent = async (
  tenantId: TenantId
): Promise<ReadEvent<TenantEvent>> =>
  await readLastEventByStreamId(tenantId, "tenant", postgresDB);
