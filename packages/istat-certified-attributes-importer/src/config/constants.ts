import crypto from "crypto";
const ISTAT_POPULATION_ATTRIBUTE_NAME = "Popolazione residente comune";
export const SUMMARY_AGE_CODE = 999;
const ISTAT_CERTIFIER_ORIGIN = "ISTAT";

function generateCodeFromName(name: string): string {
  return crypto.createHash("sha256").update(name).digest("hex");
}

export const ISTAT_ATTRIBUTE_SEED = {
  name: ISTAT_POPULATION_ATTRIBUTE_NAME,
  description:
    "Questo attributo certificato indica la popolazione che risiede in un comune",
  origin: ISTAT_CERTIFIER_ORIGIN,
  code: generateCodeFromName(ISTAT_POPULATION_ATTRIBUTE_NAME),
} as const;
