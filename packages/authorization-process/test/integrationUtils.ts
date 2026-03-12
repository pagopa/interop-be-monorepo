import {
  ReadEvent,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  Agreement,
  AuthorizationEvent,
  Client,
  ClientId,
  ClientJWKKey,
  Delegation,
  EService,
  ProducerJWKKey,
  ProducerKeychain,
  ProducerKeychainId,
  Purpose,
  toClientV2,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  clientJWKKeyReadModelServiceBuilder,
  clientReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  producerJWKKeyReadModelServiceBuilder,
  producerKeychainReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertClient,
  upsertClientJWKKey,
  upsertDelegation,
  upsertEService,
  upsertProducerJWKKey,
  upsertProducerKeychain,
  upsertPurpose,
} from "pagopa-interop-readmodel/testUtils";
import { authorizationServiceBuilder } from "../src/services/authorizationService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, postgresDB, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const producerKeychainReadModelServiceSQL =
  producerKeychainReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const clientJWKKeyReadModelServiceSQL =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
const producerJWKKeyReadModelServiceSQL =
  producerJWKKeyReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  clientReadModelServiceSQL,
  catalogReadModelServiceSQL,
  purposeReadModelServiceSQL,
  agreementReadModelServiceSQL,
  producerKeychainReadModelServiceSQL,
  delegationReadModelServiceSQL,
  clientJWKKeyReadModelServiceSQL,
  producerJWKKeyReadModelServiceSQL,
});

export const selfcareV2Client: SelfcareV2InstitutionClient =
  {} as SelfcareV2InstitutionClient;

export const authorizationService = authorizationServiceBuilder(
  postgresDB,
  readModelService,
  selfcareV2Client
);

const writeClientInEventstore = async (client: Client): Promise<void> => {
  const authorizationEvent: AuthorizationEvent = {
    type: "ClientAdded",
    event_version: 2,
    data: { client: toClientV2(client) },
  };
  const eventToWrite: StoredEvent<AuthorizationEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: authorizationEvent.data.client!.id,
    version: 0,
    event: authorizationEvent,
  };

  await writeInEventstore(eventToWrite, '"authorization"', postgresDB);
};

export const addOneKey = async (key: ClientJWKKey): Promise<void> => {
  await upsertClientJWKKey(readModelDB, key, 0);
};

export const addOneProducerKey = async (key: ProducerJWKKey): Promise<void> => {
  await upsertProducerJWKKey(readModelDB, key, 0);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeClientInEventstore(client);
  await upsertClient(readModelDB, client, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

const writeProducerKeychainInEventstore = async (
  producerKeychain: ProducerKeychain
): Promise<void> => {
  const authorizationEvent: AuthorizationEvent = {
    type: "ProducerKeychainAdded",
    event_version: 2,
    data: { producerKeychain: toProducerKeychainV2(producerKeychain) },
  };
  const eventToWrite: StoredEvent<AuthorizationEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: authorizationEvent.data.producerKeychain!.id,
    version: 0,
    event: authorizationEvent,
  };

  await writeInEventstore(eventToWrite, '"authorization"', postgresDB);
};

export const addOneProducerKeychain = async (
  producerKeychain: ProducerKeychain
): Promise<void> => {
  await writeProducerKeychainInEventstore(producerKeychain);
  await upsertProducerKeychain(readModelDB, producerKeychain, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await upsertDelegation(readModelDB, delegation, 0);
};

export const readLastAuthorizationEvent = async (
  id: ClientId | ProducerKeychainId
): Promise<ReadEvent<AuthorizationEvent>> =>
  await readLastEventByStreamId(id, '"authorization"', postgresDB);
