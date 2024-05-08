import { PurposeCollection } from "pagopa-interop-commons";
import {
  StoredEvent,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  PurposeEvent,
  generateId,
  technology,
  toPurposeV2,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";

export const addOnePurpose = async (
  purpose: Purpose,
  postgresDB: IDatabase<unknown>,
  purposes: PurposeCollection
): Promise<void> => {
  await writePurposeInEventstore(purpose, postgresDB);
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);
};

export const writePurposeInEventstore = async (
  purpose: Purpose,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const purposeEvent: PurposeEvent = {
    type: "PurposeAdded",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  };
  const eventToWrite: StoredEvent<PurposeEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: purposeEvent.data.purpose!.id,
    version: 0,
    event: purposeEvent,
  };

  await writeInEventstore(eventToWrite, "purpose", postgresDB);
};

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
  riskAnalysis: [],
  mode: "Deliver",
});
