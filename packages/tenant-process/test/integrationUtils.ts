import {
  Agreement,
  EService,
  Tenant,
  TenantEvent,
  TenantId,
  toReadModelEService,
  toReadModelTenant,
  toReadModelAgreement,
  toTenantV2,
  Attribute,
  toReadModelAttribute,
  Delegation,
} from "pagopa-interop-models";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  tenantReadModelServiceBuilder,
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  upsertAgreement,
  upsertDelegation,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

import { tenantServiceBuilder } from "../src/services/tenantService.js";
import { config } from "../src/config/config.js";

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

afterEach(async () => {
  await readModelDB.delete(tenantVerifiedAttributeVerifierInReadmodelTenant);
  await readModelDB.delete(tenantVerifiedAttributeRevokerInReadmodelTenant);

  await cleanup();
});

export const {
  agreements,
  clients,
  eservices,
  attributes,
  tenants,
  delegations,
} = readModelRepository;

const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(
  readModelDB,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  delegationReadModelServiceSQL
);

export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const tenantService = tenantServiceBuilder(postgresDB, readModelService);

export const writeTenantInEventstore = async (
  tenant: Tenant
): Promise<void> => {
  const tenantEvent: TenantEvent = {
    type: "TenantOnboarded",
    event_version: 2,
    data: { tenant: toTenantV2(tenant) },
  };
  const eventToWrite: StoredEvent<TenantEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: tenantEvent.data.tenant!.id,
    version: 0,
    event: tenantEvent,
  };
  await writeInEventstore(eventToWrite, "tenant", postgresDB);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
  await catalogReadModelServiceSQL.upsertEService(eservice, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
  await attributeReadModelServiceSQL.upsertAttribute(attribute, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeTenantInEventstore(tenant);
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
  await upsertDelegation(readModelDB, delegation, 0);
};

export const readLastTenantEvent = async (
  tenantId: TenantId
): Promise<ReadEvent<TenantEvent>> =>
  await readLastEventByStreamId(tenantId, "tenant", postgresDB);
