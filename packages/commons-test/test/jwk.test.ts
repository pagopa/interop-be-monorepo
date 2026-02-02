import { JsonWebKey } from "crypto";
import {
  calculateKid,
  calculateThumbprint,
  createJWK,
  sortJWK,
} from "pagopa-interop-commons";
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
      createJWK({
        pemKeyBase64: `LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1JSUJDZ0tDQVFFQTZzMTBhR0pNTE9QS0xqSkFsUm9seTRqY0J4NTJYMzByMTU2WlJ3dEc3bU5qU0lRTWNsTHkKQnJ4Y1ovT1hDa3dTbndiZ3AzSXE3aElMcHBnT0E5MVRJNTdHSHpCSlpnNEgvTGFhcTZJMCtjRTNSMXZQbU9wegovNVlzRFB0Q3hydk1zaGFFaU5hSlprL0JjdEpNdGxhck5NWlZTRVVuaS9yNUlyeU1WZG1nQ01pUGhmZkdWQnZwCkphVTVOTkFDZFV0N0tsdUdubWxqT2QxNWdMc1FibkhXWUVGVEx1UlU1VDJiQS9Hb0JLUkVpejhjc29kRno4TTQKRDU5dDB6TjlQZHk1aEF6eXRuUnNQcnBwcHZyUzFFck9QTGluTWFya0tTZGdtSldsdENxeVhWeCtiZ1FmbGN0cQpjS01NbU1vem9LMzJ1VHNjZDh5NGFETGlvdk9zaVlxM1l3SURBUUFCCi0tLS0tRU5EIFJTQSBQVUJMSUMgS0VZLS0tLS0=`,
      })
    );
    expect(kid).toEqual(expetedKid);
  });

  describe("calculateThumbprint", () => {
    // https://datatracker.ietf.org/doc/html/rfc7638#section-3.1 (example from RFC 7638 )
    const validRsaKey: JsonWebKey = {
      kty: "RSA",
      n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
      e: "AQAB",
    };

    it("should return the correct SHA-256 thumbprint (RFC 7638 match)", () => {
      expect(calculateThumbprint(validRsaKey)).toEqual(
        "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"
      );
    });

    it("should produce the same thumbprint ignoring extra properties", () => {
      const keyWithExtras: JsonWebKey = {
        ...validRsaKey,
        alg: "RS256",
        kid: "ignore-me",
        use: "sig",
      };

      const hashClean = calculateThumbprint(validRsaKey);
      const hashExtras = calculateThumbprint(keyWithExtras);

      expect(hashExtras).toEqual(hashClean);
    });

    it("should throw if kty is not RSA", () => {
      const ecKey: JsonWebKey = { kty: "EC", x: "foo", y: "bar", crv: "P-256" };
      expect(() => calculateThumbprint(ecKey)).toThrow();
    });

    it("should throw if required RSA properties (n, e) are missing", () => {
      const missingE = { kty: "RSA", n: "foo" } as JsonWebKey;
      expect(() => calculateThumbprint(missingE)).toThrow();
    });
  });
});
