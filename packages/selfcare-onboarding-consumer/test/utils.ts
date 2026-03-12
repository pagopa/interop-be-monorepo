/* eslint-disable @typescript-eslint/no-empty-function */
import { EachMessagePayload } from "kafkajs";
import { tenantApi } from "pagopa-interop-api-clients";
import { InteropInternalToken } from "pagopa-interop-commons";

export const interopProductName = "test-interop-product";
export const allowedOrigins = [
  "IPA",
  "ANAC",
  "IVASS",
  "INFOCAMERE-PRV",
  "INFOCAMERE-SCP",
  "INFOCAMERE-PT",
];

export const selfcareUpsertTenantMock = (): Promise<tenantApi.ResourceId> =>
  Promise.resolve({ id: "tenant-id" });

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
  institutionId: "b730fbb7-fffe-4090-a3ea-53ee7e07a4b9",
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

export const kafkaMessagePayload: EachMessagePayload = {
  topic: "kafka-test-topic",
  partition: 0,
  message: {
    key: Buffer.from("kafka-message-key"),
    value: Buffer.from(JSON.stringify(correctEventPayload)),
    timestamp: "0",
    attributes: 0,
    offset: "10",
    size: 100,
  },
  heartbeat: async () => {},
  pause: () => () => {},
};

export const generateInternalTokenMock = (): Promise<InteropInternalToken> =>
  Promise.resolve(interopInternalToken);

export const interopInternalToken: InteropInternalToken = {
  header: {
    alg: "algorithm",
    use: "use",
    typ: "type",
    kid: "key-id",
  },
  payload: {
    jti: "token-id",
    iss: "issuer",
    aud: ["audience1"],
    sub: "subject",
    iat: 0,
    nbf: 0,
    exp: 10,
    role: "internal",
  },
  serialized: "the-token",
};

export const uuidRegexp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
