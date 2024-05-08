import {
  AgreementCollection,
  EServiceCollection,
} from "pagopa-interop-commons";
import { writeInReadmodel } from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  EService,
  toReadModelEService,
} from "pagopa-interop-models";

export const addOneAgreement = async (
  agreement: Agreement,
  agreements: AgreementCollection
): Promise<void> => {
  await writeInReadmodel(agreement, agreements);
};

export const addOneEService = async (
  eservice: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};
