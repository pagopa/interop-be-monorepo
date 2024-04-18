import {
  Agreement,
  AgreementEvent,
  AgreementId,
  EService,
  Tenant,
  toReadModelEService,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  AgreementCollection,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";

export const writeAgreementInEventstore = async (
  agreement: Agreement,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const agreementEvent: AgreementEvent = {
    type: "AgreementAdded",
    event_version: 1,
    data: { agreement: toAgreementV1(agreement) },
  };
  const eventToWrite: StoredEvent<AgreementEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: agreementEvent.data.agreement!.id,
    version: 0,
    event: agreementEvent,
  };

  await writeInEventstore(eventToWrite, "agreement", postgresDB);
};

export const addOneAgreement = async (
  agreement: Agreement,
  postgresDB: IDatabase<unknown>,
  agreements: AgreementCollection
): Promise<void> => {
  await writeAgreementInEventstore(agreement, postgresDB);
  await writeInReadmodel(agreement, agreements);
};

export const addOneEService = async (
  eservice: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneTenant = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await writeInReadmodel(tenant, tenants);
};

export const readLastAgreementEvent = async (
  agreementId: AgreementId,
  postgresDB: IDatabase<unknown>
): Promise<ReadEvent<AgreementEvent>> =>
  await readLastEventByStreamId(agreementId, "agreement", postgresDB);
