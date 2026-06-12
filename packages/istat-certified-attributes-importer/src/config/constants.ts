import crypto from "crypto";
const ISTAT_POPULATION_ATTRIBUTE_NAME = "popolazione_residente";
export const SUMMARY_AGE_CODE = 999;
const ISTAT_CERTIFIER_ORIGIN = "ISTAT";

function generateCodeFromName(name: string): string {
  return crypto.createHash("sha256").update(name).digest("hex");
}

export const ISTAT_ATTRIBUTE_SEED = {
  name: ISTAT_POPULATION_ATTRIBUTE_NAME,
  description:
    "Attributo certificato discreto indicante la popolazione comunale",
  origin: ISTAT_CERTIFIER_ORIGIN,
  code: generateCodeFromName(ISTAT_POPULATION_ATTRIBUTE_NAME),
} as const;
