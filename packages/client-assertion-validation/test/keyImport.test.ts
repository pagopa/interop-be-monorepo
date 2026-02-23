import { KeyObject } from "crypto";
import { describe, expect, it } from "vitest";
import * as jose from "jose";
import { createPublicKey, decodeBase64ToPem } from "pagopa-interop-commons";
import { algorithm } from "pagopa-interop-models";

describe("key import", async () => {
  const encodedPEM =
    "LS1rZXlQYXRoIC9Vc2Vycy9nYWxhbGVzL2Rldi9taXNjL2NsaWVudEFzc2VydGlvbi9rZXkvY2xpZW50LWFzc2VydGlvbi5yc2EucHJpdgotLS0tLUJFR0lOIFBVQkxJQyBLRVktLS0tLQpNSUlCSWpBTkJna3Foa2lHOXcwQkFRRUZBQU9DQVE4QU1JSUJDZ0tDQVFFQXZxSUwwTXdKaU5JNnZTbFltNy91CkVQd1drTDBzNzlSNUJ4bmkzRXVPay93RXkyOFBCMk5ReHppVDNqRFpkTHFqTFJ0OHNYWXAwUzBMWTVlUk5xRDkKV3lQU2JCSCtRMGg2cU1QUFRoVWcrSXA1Ly9vMWF5QkhPSE14eWJyR3RGYXNSa2NYakEyVitZbWRXanBlWHBuVwpQeEo3ZTRJYUljanh4QmdFUG5zcTBhN1Z5OUdTWElsZk9zaEZ0Q2tkc1o3V25hbmVXRzNnK2ZVSUttSTlHcGVSCk42b0dSVDE3ckY4d3R1L2JxQVV0L0taUm9CeGVpMERWQkhnaytsdEpzVmx0MTRQcXRCbnpTdmluMXRvVEhpM2wKbnhyNUJBZnVZc25YRHZaTmVNeXU4U3pTQy9kKzNBQUFtY3JWSmNXTTlHZVU4OXpVeHlUUWlKbmx5SDJQZjFicQpaUUlEQVFBQgotLS0tLUVORCBQVUJMSUMgS0VZLS0tLS0=";

  it("fails when importing a PEM without trailing newline with jose", async () => {
    await expect(
      jose.importSPKI(decodeBase64ToPem(encodedPEM), algorithm.RS256)
    ).rejects.toThrowError(`"spki" must be SPKI formatted string`);
  });

  it("succeeds when importing the same PEM with crypto", async () => {
    const result = createPublicKey({ key: encodedPEM });
    expect(result).toBeInstanceOf(KeyObject);
  });
});
