import { describe, it, expect, vi, afterEach } from "vitest";
import { missingHeader, badDPoPToken } from "pagopa-interop-models";
import {
  genericLogger,
  jwtsFromAuthAndDPoPHeaders,
} from "pagopa-interop-commons";

describe("headers", () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const mockRequest = (headers: Record<string, string | undefined>) =>
    ({
      headers,
      method: "GET",
      url: "/test/example/endpoint",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("jwtsFromAuthAndDPoPHeaders", () => {
    it("Should correctly extract Access Token and DPoP Proof when headers are valid", () => {
      const req = mockRequest({
        authorization: "DPoP some-access-token",
        dpop: "some-dpop-proof",
      });

      const result = jwtsFromAuthAndDPoPHeaders(req, genericLogger);

      expect(result).toEqual({
        accessToken: "some-access-token",
        dpopProofJWS: "some-dpop-proof",
      });
    });

    it("Should throw missingHeader('Authorization') if Authorization header is missing", () => {
      const req = mockRequest({
        dpop: "some-dpop-proof",
      });

      expect(() => jwtsFromAuthAndDPoPHeaders(req, genericLogger)).toThrowError(
        missingHeader("Authorization")
      );
    });

    it("Should throw badDPoPToken if Authorization token scheme is not 'DPoP'", () => {
      const req = mockRequest({
        authorization: "Bearer some-token",
        dpop: "some-dpop-proof",
      });

      expect(() => jwtsFromAuthAndDPoPHeaders(req, genericLogger)).toThrowError(
        badDPoPToken
      );
    });

    it("Should throw badDPoPToken if Authorization token value is missing", () => {
      const req = mockRequest({
        authorization: "DPoP",
        dpop: "some-dpop-proof",
      });

      expect(() => jwtsFromAuthAndDPoPHeaders(req, genericLogger)).toThrowError(
        badDPoPToken
      );
    });

    it("Should throw missingHeader('DPoP') if DPoP header is missing", () => {
      const req = mockRequest({
        authorization: "DPoP valid-token",
      });

      expect(() => jwtsFromAuthAndDPoPHeaders(req, genericLogger)).toThrowError(
        missingHeader("DPoP")
      );
    });

    it("Should throw missingHeader('DPoP') if DPoP header is empty string", () => {
      const req = mockRequest({
        authorization: "DPoP valid-token",
        dpop: "",
      });

      expect(() => jwtsFromAuthAndDPoPHeaders(req, genericLogger)).toThrowError(
        missingHeader("DPoP")
      );
    });
  });
});
