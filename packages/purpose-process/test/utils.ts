import { PurposeCollection } from "pagopa-interop-commons";
import {
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  PurposeEvent,
  generateId,
  purposeEventToBinaryData,
  technology,
  toPurposeV2,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";

export const addOnePurpose = async (
  purpose: Purpose,
  postgresDB: IDatabase<unknown>,
  purposes: PurposeCollection
): Promise<void> => {
  await writePurposeInEventstore(purpose, postgresDB);
  await writeInReadmodel(purpose, purposes);
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
  const eventToWrite = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: purposeEvent.data.purpose!.id,
    version: "0",
    type: purposeEvent.type,
    event_version: purposeEvent.event_version,
    data: purposeEventToBinaryData(purposeEvent),
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
