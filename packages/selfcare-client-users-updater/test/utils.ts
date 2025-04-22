/* eslint-disable @typescript-eslint/no-empty-function */
import { EachMessagePayload } from "kafkajs";
import { InteropToken } from "pagopa-interop-commons";
import { generateId, UserId } from "pagopa-interop-models";

export const allowedOriginsUuid = ["b730fbb7-fffe-4090-a3ea-53ee7e07a4b9"];

export const correctEventPayload = {
  id: "cfb4f57f-8d93-4e30-8c87-37a29c3c6dac",
  institutionId: "b730fbb7-fffe-4090-a3ea-53ee7e07a4b9",
  productId: "test-interop-product-identifierr",
  onboardingTokenClient: undefined,
  eventType: "UPDATE",
  createdAt: "2023-08-04T09:08:09.723118Z",
  updatedAt: "2023-08-04T09:08:09.723137Z",
  user: {
    userId: generateId<UserId>(),
    name: "Test Name",
    familyName: "Test Family",
    email: "test@test.com",
    role: "Test Role",
    productRole: "API_ROLE",
    relationshipStatus: "ACTIVE",
    mobilePhone: "1234567890",
  },
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

export const generateInternalTokenMock = (): Promise<InteropToken> =>
  Promise.resolve(interopToken);

export const interopToken: InteropToken = {
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
    role: "role1",
  },
  serialized: "the-token",
};
