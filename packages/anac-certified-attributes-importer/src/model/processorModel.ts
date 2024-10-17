import { ExternalId } from "pagopa-interop-models";
import { CsvRow } from "./csvRowModel.js";

export type BatchParseResult = {
  processedRecordsCount: number;
  records: CsvRow[];
};

export type AttributeIdentifiers = {
  id: string;
  externalId: ExternalId;
};

export type AnacAttributes = {
  anacAbilitato: AttributeIdentifiers;
  anacInConvalida: AttributeIdentifiers;
  anacIncaricato: AttributeIdentifiers;
};
