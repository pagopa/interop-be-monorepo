import {
  ReadEvent,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
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
  toReadModelAgreement,
  toReadModelClient,
  toReadModelEService,
  toReadModelProducerKeychain,
  toReadModelPurpose,
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
  upsertEService,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { authorizationServiceBuilder } from "../src/services/authorizationService.js";
import { config } from "../src/config/config.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, readModelRepository, postgresDB, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const {
  agreements,
  clients,
  eservices,
  keys,
  purposes,
  tenants,
  producerKeychains,
  delegations,
  producerKeys,
} = readModelRepository;

export const clientReadModelServiceSQL =
  clientReadModelServiceBuilder(readModelDB);
export const catalogReadModelServiceSQL =
  catalogReadModelServiceBuilder(readModelDB);
export const purposeReadModelServiceSQL =
  purposeReadModelServiceBuilder(readModelDB);
export const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
export const producerKeychainReadModelServiceSQL =
  producerKeychainReadModelServiceBuilder(readModelDB);
export const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
export const clientJWKKeyReadModelServiceSQL =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
export const producerJWKKeyReadModelServiceSQL =
  producerJWKKeyReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL({
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
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const selfcareV2Client: SelfcareV2InstitutionClient =
  {} as SelfcareV2InstitutionClient;

export const authorizationService = authorizationServiceBuilder(
  postgresDB,
  readModelService,
  selfcareV2Client
);

export const writeClientInEventstore = async (
  client: Client
): Promise<void> => {
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
  await writeInReadmodel(key, keys);

  await clientJWKKeyReadModelServiceSQL.upsertClientJWKKey(key, 0);
};

export const addOneProducerKey = async (key: ProducerJWKKey): Promise<void> => {
  await writeInReadmodel(key, producerKeys);

  await producerJWKKeyReadModelServiceSQL.upsertProducerJWKKey(key, 0);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeClientInEventstore(client);
  await writeInReadmodel(toReadModelClient(client), clients);

  await clientReadModelServiceSQL.upsertClient(client, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);

  await purposeReadModelServiceSQL.upsertPurpose(purpose, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);

  await upsertEService(readModelDB, eservice, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);

  await upsertAgreement(readModelDB, agreement, 0);
};

export const writeProducerKeychainInEventstore = async (
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
  await writeInReadmodel(
    toReadModelProducerKeychain(producerKeychain),
    producerKeychains
  );

  await producerKeychainReadModelServiceSQL.upsertProducerKeychain(
    producerKeychain,
    0
  );
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);

  await delegationReadModelServiceSQL.upsertDelegation(delegation, 0);
};

export const readLastAuthorizationEvent = async (
  id: ClientId | ProducerKeychainId
): Promise<ReadEvent<AuthorizationEvent>> =>
  await readLastEventByStreamId(id, '"authorization"', postgresDB);
