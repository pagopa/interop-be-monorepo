import { MessageSetEntry } from "kafkajs";
// import { tenantApi } from "pagopa-interop-api-clients";

// import { afterEach, inject } from "vitest";
// import { setupTestContainersVitest } from "pagopa-interop-commons-test";

// export const { cleanup, readModelRepository } = await setupTestContainersVitest(
//   inject("readModelConfig")
// );

// afterEach(cleanup);

// export const { tenants } =
//   readModelRepository;

export const interopProductName = "test-interop-product";
export const allowedOrigins = ["IPA", "ANAC", "IVASS"];

// export const selfcareUpsertTenantMock = (
//   _seed: tenantApi.SelfcareTenantSeed,
//   _context: InteropContext
// ): Promise<SelfcareUpsertTenantResponse> =>
//   Promise.resolve({ id: "tenant-id" });

export const correctInstitutionEventField = {
  institutionType: "PA",
  description: "Somewhere",
  digitalAddress: "somewhere@wonderland",
  address: "123 Street",
  taxCode: "12345678987",
  origin: "IPA",
  originId: "ipa_code",
  zipCode: "12345",
  paymentServiceProvider: null,
  istatCode: "123456",
  city: "somewhere",
  country: "wonderland",
  county: "WL",
  subUnitCode: null,
  subUnitType: null,
  rootParent: {
    id: null,
    description: null,
  },
};

export const correctEventPayload = {
  id: "cfb4f57f-8d93-4e30-8c87-37a29c3c6dac",
  internalIstitutionID: "b730fbb7-fffe-4090-a3ea-53ee7e07a4b9",
  product: interopProductName,
  state: "ACTIVE",
  fileName: "",
  contentType: "application/json",
  onboardingTokenId: "8e73950f-b51d-46df-92a1-057907f2cb98",
  institution: correctInstitutionEventField,
  billing: {
    vatNumber: "12345678987",
    recipientCode: "11111",
    publicServices: false,
  },
  createdAt: "2023-08-04T09:08:09.723118Z",
  updatedAt: "2023-08-04T09:08:09.723137Z",
  notificationType: "ADD",
};

export const kafkaMessage: MessageSetEntry = {
  key: Buffer.from("kafka-message-key"),
  value: Buffer.from(JSON.stringify(correctEventPayload)),
  timestamp: "0",
  attributes: 0,
  offset: "10",
  size: 100,
};

export const selfcareUpsertTenantSeed = {
  externalId: {
    origin: correctEventPayload.institution.origin,
    value: correctEventPayload.institution.originId,
  },
  selfcareId: correctEventPayload.internalIstitutionID,
  name: correctEventPayload.institution.description,
};
