import { JsonWebKey } from "crypto";
import { calculateKid, createJWK, sortJWK } from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";

describe("jwk test", () => {
  it("should sort the JWK", async () => {
    const unorderedJWK: JsonWebKey = {
      e: "E",
      n: "ABCD",
      kty: "RSA",
    };

    const orderedJWK = sortJWK(unorderedJWK);
    expect(Object.keys(orderedJWK)).toEqual(["e", "kty", "n"]);
  });
  it("should calculate the kid", async () => {
    const expetedKid = "23j6WZbSbFiX_By98MBDgjnL3ZPkJJU83euQxrZxVsA";
    const kid = calculateKid(
      createJWK(`-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEA6s10aGJMLOPKLjJAlRoly4jcBx52X30r156ZRwtG7mNjSIQMclLy
BrxcZ/OXCkwSnwbgp3Iq7hILppgOA91TI57GHzBJZg4H/Laaq6I0+cE3R1vPmOpz
/5YsDPtCxrvMshaEiNaJZk/BctJMtlarNMZVSEUni/r5IryMVdmgCMiPhffGVBvp
JaU5NNACdUt7KluGnmljOd15gLsQbnHWYEFTLuRU5T2bA/GoBKREiz8csodFz8M4
D59t0zN9Pdy5hAzytnRsPrpppvrS1ErOPLinMarkKSdgmJWltCqyXVx+bgQflctq
cKMMmMozoK32uTscd8y4aDLiovOsiYq3YwIDAQAB
-----END RSA PUBLIC KEY-----`)
    );
    expect(kid).toEqual(expetedKid);
  });
});
