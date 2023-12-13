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
  EService,
  EServiceEvent,
  Tenant,
  agreementState,
  catalogEventToBinaryData,
  descriptorState,
  technology,
} from "pagopa-interop-models";
import { MessageType } from "@protobuf-ts/runtime";
import { toEServiceV1 } from "../src/model/domain/toEvent.js";
import { EServiceDescriptorSeed } from "../src/model/domain/models.js";

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
  id: uuidv4(),
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId: uuidv4(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
});

export const getMockDescriptor = (): Descriptor => ({
  id: uuidv4(),
  version: "0",
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

export const getMockTenant = (): Tenant => ({
  name: "A tenant",
  id: uuidv4(),
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
  eServiceId,
  descriptorId,
  producerId,
  consumerId,
}: {
  eServiceId: string;
  descriptorId: string;
  producerId: string;
  consumerId: string;
}): Agreement => ({
  id: uuidv4(),
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

export function decode<I extends object>({
  messageType,
  payload,
}: {
  messageType: MessageType<I>;
  payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}): I {
  return messageType.fromBinary(Buffer.from(payload, "hex"));
}
