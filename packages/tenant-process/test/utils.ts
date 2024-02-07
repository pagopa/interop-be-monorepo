import { MessageType } from "@protobuf-ts/runtime";
import {
  AgreementCollection,
  AuthData,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  EService,
  Tenant,
  TenantEvent,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  agreementState,
  descriptorState,
  generateId,
  technology,
  tenantEventToBinaryData,
  unsafeBrandId,
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

export const getMockVerifiedBy = (): TenantVerifier => ({
  id: generateId(),
  verificationDate: new Date(),
  expirationDate: new Date(),
  extensionDate: new Date(),
});

export const getMockRevokedBy = (): TenantRevoker => ({
  id: generateId(),
  verificationDate: new Date(),
  revocationDate: new Date(),
  expirationDate: new Date(),
  extensionDate: new Date(),
});

export const getMockVerifiedTenantAttribute = (): VerifiedTenantAttribute => ({
  id: generateId(),
  type: "verified",
  assignmentTimestamp: new Date(),
  verifiedBy: [
    {
      ...getMockVerifiedBy(),
    },
  ],
  revokedBy: [
    {
      ...getMockRevokedBy(),
    },
  ],
});
export const getMockAuthData = (organizationId?: string): AuthData => ({
  organizationId: unsafeBrandId(organizationId || generateId()),
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
  id: generateId(),
  createdAt: new Date(),
  eserviceId: unsafeBrandId(eServiceId),
  descriptorId: unsafeBrandId(descriptorId),
  producerId: unsafeBrandId(producerId),
  consumerId: unsafeBrandId(consumerId),
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

export const readLastEventByStreamId = async (
  tenantId: string,
  postgresDB: IDatabase<unknown>
): Promise<any> => // eslint-disable-line @typescript-eslint/no-explicit-any
  await postgresDB.one(
    "SELECT * FROM tenant.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1",
    [tenantId]
  );

export function decodeProtobufPayload<I extends object>({
  messageType,
  payload,
}: {
  messageType: MessageType<I>;
  payload: Parameters<typeof Buffer.from>[0];
}): I {
  return messageType.fromBinary(Buffer.from(payload, "hex"));
}
