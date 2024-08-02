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
      createJWK(
        `LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1JSUJDZ0tDQVFFQTZzMTBhR0pNTE9QS0xqSkFsUm9seTRqY0J4NTJYMzByMTU2WlJ3dEc3bU5qU0lRTWNsTHkKQnJ4Y1ovT1hDa3dTbndiZ3AzSXE3aElMcHBnT0E5MVRJNTdHSHpCSlpnNEgvTGFhcTZJMCtjRTNSMXZQbU9wegovNVlzRFB0Q3hydk1zaGFFaU5hSlprL0JjdEpNdGxhck5NWlZTRVVuaS9yNUlyeU1WZG1nQ01pUGhmZkdWQnZwCkphVTVOTkFDZFV0N0tsdUdubWxqT2QxNWdMc1FibkhXWUVGVEx1UlU1VDJiQS9Hb0JLUkVpejhjc29kRno4TTQKRDU5dDB6TjlQZHk1aEF6eXRuUnNQcnBwcHZyUzFFck9QTGluTWFya0tTZGdtSldsdENxeVhWeCtiZ1FmbGN0cQpjS01NbU1vem9LMzJ1VHNjZDh5NGFETGlvdk9zaVlxM1l3SURBUUFCCi0tLS0tRU5EIFJTQSBQVUJMSUMgS0VZLS0tLS0=`
      )
    );
    expect(kid).toEqual(expetedKid);
  });
});
