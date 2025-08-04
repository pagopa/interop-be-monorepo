import {
  ExportedAgreement,
  ExportedCollection,
  ExportedEService,
  ExportedPurpose,
  ExportedTenant,
} from "../config/models/models.js";
import { arrayToNdjson, splitArrayIntoChunks } from "../utils/helperUtils.js";

export type ExportedData = [
  collection: ExportedCollection,
  ndjsonFiles: string[],
  count: number
];

const generateNdjsonFiles = (
  data: Array<
    ExportedAgreement | ExportedEService | ExportedPurpose | ExportedTenant
  >,
  exportTimestamp: Date
): string[] => {
  const dataWithTimestamp = data.map((item) => ({ ...item, exportTimestamp }));
  const dataChunks = splitArrayIntoChunks(dataWithTimestamp, 1000);

  return dataChunks.map(arrayToNdjson);
};

export const buildDataToExport = (
  tenants: ExportedTenant[],
  eservices: ExportedEService[],
  agreements: ExportedAgreement[],
  purposes: ExportedPurpose[],
  exportTimestamp: Date
): ExportedData[] => [
  ["tenants", generateNdjsonFiles(tenants, exportTimestamp), tenants.length],
  [
    "eservices",
    generateNdjsonFiles(eservices, exportTimestamp),
    eservices.length,
  ],
  [
    "agreements",
    generateNdjsonFiles(agreements, exportTimestamp),
    agreements.length,
  ],
  ["purposes", generateNdjsonFiles(purposes, exportTimestamp), purposes.length],
];
