/* eslint-disable @typescript-eslint/no-empty-function */
import { EachMessagePayload } from "kafkajs";
import { InteropInternalToken, userRole } from "pagopa-interop-commons";
import {
  Client,
  generateId,
  Tenant,
  toReadModelClient,
  toReadModelTenant,
  UserId,
} from "pagopa-interop-models";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { clientReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { config } from "../src/config/config.js";

export const correctEventPayload = {
  id: "cfb4f57f-8d93-4e30-8c87-37a29c3c6dac",
  institutionId: "b730fbb7-fffe-4090-a3ea-53ee7e07a4b9",
  productId: "test-interop-product-identifier",
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
    productRole: userRole.ADMIN_ROLE,
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

export const generateInternalTokenMock = (): Promise<InteropInternalToken> =>
  Promise.resolve(interopToken);

export const interopToken: InteropInternalToken = {
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

export const { cleanup, readModelRepository, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const { clients, tenants } = readModelRepository;

const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  clientReadModelServiceSQL,
});
export const readModelService = config.featureFlagSQL
  ? readModelServiceSQL
  : oldReadModelService;

export const addOneClient = async (client: Client): Promise<void> => {
  await writeInReadmodel(toReadModelClient(client), clients);

  await clientReadModelServiceSQL.upsertClient(client, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
  await upsertTenant(readModelDB, tenant, 0);
};
