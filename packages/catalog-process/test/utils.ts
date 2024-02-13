import {
  AgreementCollection,
  AuthData,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { v4 as uuidv4 } from "uuid";
import {
  Agreement,
  Descriptor,
  DescriptorId,
  Document,
  EService,
  EServiceEvent,
  EServiceId,
  Tenant,
  TenantId,
  agreementState,
  catalogEventToBinaryData,
  descriptorState,
  generateId,
  technology,
} from "pagopa-interop-models";
import { toEServiceV1 } from "../src/model/domain/toEvent.js";
import { EServiceDescriptorSeed } from "../src/model/domain/models.js";
import { ApiEServiceDescriptorDocumentSeed } from "../src/model/types.js";

export const writeEServiceInEventstore = async (
  eService: EService,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const eServiceEvent: EServiceEvent = {
    type: "EServiceAdded",
    data: { eService: toEServiceV1(eService) },
  };
  const eventToWrite = {
    stream_id: eServiceEvent.data.eService?.id,
    version: 0,
    type: eServiceEvent.type,
    data: Buffer.from(catalogEventToBinaryData(eServiceEvent)),
  };

  await postgresDB.none(
    "INSERT INTO catalog.events(stream_id, version, type, data) VALUES ($1, $2, $3, $4)",
    [
      eventToWrite.stream_id,
      eventToWrite.version,
      eventToWrite.type,
      eventToWrite.data,
    ]
  );
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

export const getMockAuthData = (organizationId?: string): AuthData => ({
  organizationId: organizationId || uuidv4(),
  userId: uuidv4(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
});

export const buildDescriptorSeed = (
  descriptor: Descriptor
): EServiceDescriptorSeed => ({
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: descriptor.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
});

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId: uuidv4(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
});

export const getMockDescriptor = (): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: descriptorState.draft,
  audience: [],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: ["pagopa.it"],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
});

export const buildInterfaceSeed = (): ApiEServiceDescriptorDocumentSeed => ({
  contentType: "json",
  prettyName: "prettyName",
  serverUrls: ["pagopa.it"],
  documentId: uuidv4(),
  kind: "INTERFACE",
  filePath: "filePath",
  fileName: "fileName",
  checksum: "checksum",
});

export const getMockDocument = (): Document => ({
  name: "fileName",
  path: "filePath",
  id: uuidv4(),
  prettyName: "prettyName",
  contentType: "json",
  checksum: uuidv4(),
  uploadDate: new Date(),
});

export const getMockTenant = (): Tenant => ({
  name: "A tenant",
  id: generateId(),
  createdAt: new Date(),
  attributes: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  features: [],
  mails: [],
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

export const addOneEService = async (
  eService: EService,
  postgresDB: IDatabase<unknown>,
  eservices: EServiceCollection
): Promise<void> => {
  await writeEServiceInEventstore(eService, postgresDB);
  await writeEServiceInReadmodel(eService, eservices);
};

export const addOneTenant = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await writeTenantInReadmodel(tenant, tenants);
};

export const addOneAgreement = async (
  agreement: Agreement,
  agreements: AgreementCollection
): Promise<void> => {
  await writeAgreementInReadmodel(agreement, agreements);
};

export const readLastEventByStreamId = async (
  eserviceId: EServiceId,
  postgresDB: IDatabase<unknown>
): Promise<any> => // eslint-disable-line @typescript-eslint/no-explicit-any
  await postgresDB.one(
    "SELECT * FROM catalog.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1",
    [eserviceId]
  );
