import { createHash } from "crypto";
import { bffApi, attributeRegistryApi } from "pagopa-interop-api-clients";

export const toApiAttributeProcessSeed = (
  seed: bffApi.AttributeSeed
): attributeRegistryApi.CertifiedAttributeSeed => ({
  ...seed,
  code: createHash("sha256").update(seed.name).digest("hex"),
});
