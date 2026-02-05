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
    // https://datatracker.ietf.org/doc/html/rfc7638#section-3.1 (example from RFC 7638)
    const validRsaKey: JsonWebKey = {
      kty: "RSA",
      n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
      e: "AQAB",
    };
    const validEcKey: JsonWebKey = {
      kty: "EC",
      crv: "P-256",
      x: "MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
      y: "4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
    };

    it("should return the correct SHA-256 thumbprint (RFC 7638 match)", () => {
      expect(calculateThumbprint(validRsaKey)).toEqual(
        "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"
      );
    });

    it("should return the correct SHA-256 thumbprint for EC", () => {
      expect(calculateThumbprint(validEcKey)).toEqual(
        "cn-I_WNMClehiVp51i_0VpOENW1upEerA8sEam5hn-s"
      );
    });

    it("should produce the same thumbprint ignoring extra properties (RSA)", () => {
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

    it("should produce the same thumbprint ignoring extra properties (EC)", () => {
      const keyWithExtras: JsonWebKey = {
        ...validEcKey,
        alg: "ES256",
        kid: "ignore-me-ec",
        use: "sig",
      };

      const hashClean = calculateThumbprint(validEcKey);
      const hashExtras = calculateThumbprint(keyWithExtras);

      expect(hashExtras).toEqual(hashClean);
    });

    it("should throw if kty is unsupported (e.g. oct)", () => {
      const octKey: JsonWebKey = { kty: "oct", k: "secret-key" };
      expect(() => calculateThumbprint(octKey)).toThrow();
    });

    it("should throw if required RSA properties (n, e) are missing", () => {
      const missingE = { kty: "RSA", n: "foo" } as JsonWebKey;
      expect(() => calculateThumbprint(missingE)).toThrow();
    });

    it("should throw if required EC properties (crv, x, y) are missing", () => {
      const missingX = { kty: "EC", crv: "P-256", y: "bar" } as JsonWebKey;
      expect(() => calculateThumbprint(missingX)).toThrow(
        "One or more required JWK claims are missing"
      );
    });
  });
});
