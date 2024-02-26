import {
  AgreementCollection,
  AttributeCollection,
  AuthData,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { v4 as uuidv4 } from "uuid";
import {
  Agreement,
  Attribute,
  Descriptor,
  DescriptorId,
  Document,
  EService,
  EServiceAttribute,
  EServiceEvent,
  EServiceId,
  EserviceAttributes,
  Tenant,
  TenantId,
  agreementState,
  catalogEventToBinaryData,
  descriptorState,
  eserviceMode,
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
    event_version: 1,
    data: { eService: toEServiceV1(eService) },
  };
  const eventToWrite = {
    stream_id: eServiceEvent.data.eService?.id,
    version: 0,
    type: eServiceEvent.type,
    event_version: eServiceEvent.event_version,
    data: Buffer.from(catalogEventToBinaryData(eServiceEvent)),
  };

  await postgresDB.none(
    "INSERT INTO catalog.events(stream_id, version, type, event_version, data) VALUES ($1, $2, $3, $4, $5)",
    [
      eventToWrite.stream_id,
      eventToWrite.version,
      eventToWrite.type,
      eventToWrite.event_version,
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

export const writeAttributeInReadmodel = async (
  attribute: Attribute,
  attributes: AttributeCollection
): Promise<void> => {
  await attributes.insertOne({
    data: attribute,
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

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
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
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
  mode: eserviceMode.deliver,
  riskAnalysis: [],
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

export const getMockEServiceAttribute = (): EServiceAttribute => ({
  id: generateId(),
  explicitAttributeVerification: false,
});

export const getMockEServiceAttributes = (): EserviceAttributes => ({
  certified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  declared: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  verified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
});

export const buildInterfaceSeed = (): ApiEServiceDescriptorDocumentSeed => ({
  contentType: "json",
  prettyName: "prettyName",
  serverUrls: ["pagopa.it"],
  documentId: generateId(),
  kind: "INTERFACE",
  filePath: "filePath",
  fileName: "fileName",
  checksum: "checksum",
});

export const getMockDocument = (): Document => ({
  name: "fileName",
  path: "filePath",
  id: generateId(),
  prettyName: "prettyName",
  contentType: "json",
  checksum: generateId(),
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

export const addOneAttribute = async (
  attribute: Attribute,
  attributes: AttributeCollection
): Promise<void> => {
  await writeAttributeInReadmodel(attribute, attributes);
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
