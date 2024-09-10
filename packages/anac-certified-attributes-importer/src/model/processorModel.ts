import { CsvRow } from "./csvRowModel.js";
import { PersistentExternalId } from "./tenantModel.js";

export type BatchParseResult = {
  processedRecordsCount: number;
  records: CsvRow[];
};

export type AttributeIdentifiers = {
  id: string;
  externalId: PersistentExternalId;
};

export type AnacAttributes = {
  anacAbilitato: AttributeIdentifiers;
  anacInConvalida: AttributeIdentifiers;
  anacIncaricato: AttributeIdentifiers;
};
