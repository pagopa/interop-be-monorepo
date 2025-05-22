import {
  InteropJwtApiM2MAdminPayload,
  InteropJwtApiM2MPayload,
  InteropJwtApiPayload,
  InteropJwtConsumerPayload,
  InteropJwtInternalPayload,
  InteropJwtUIPayload,
} from "./models.js";

// ===========================================
//    Auth tokens payloads
// serialization type and utilities
// ===========================================

/*
  Serialization are used only in the generation phase in IteroptokenService, 
  zod don't offers a valid encoder function to serialize the payload, 
  so we need to implement it manually because we need to serialize the payload
   in a different way from the parsing phase.

  SerializedAuthTokenPayload is a union of all payloads we actually
  generate and need to serialize in the generation phase. It does not include
  the payloads we don't generate in this repo (e.g. maintenance tokens).
 */
export type SerializedAuthTokenPayload =
  | SerializedInteropJwtInternalPayload
  | SerializedInteropJwtApiPayload
  | SerializedInteropJwtConsumerPayload
  | SerializedInteropJwtUIPayload;

/* 
  Serialize the payload of the Interop UI JWT, the "aud"
  is serialized in comma-separated string.
*/
export function toJwtSerializedAudience(input: string | string[]): string {
  return Array.isArray(input) ? input.join(",") : input;
}

/*
  Serialize the payload of the Interop UI JWT, the "aud","user-roles" 
  are serialized in comma-separated string.
*/
export function toSerializedJwtUIPayload(
  tokenPayload: InteropJwtUIPayload
): SerializedInteropJwtUIPayload {
  return {
    ...tokenPayload,
    "user-roles": tokenPayload["user-roles"].join(","),
    aud: toJwtSerializedAudience(tokenPayload.aud),
  };
}

/* 
  This function is used to serialize the payload of the Interop Jwts,
  At the moment interopTokenService only generates the InteropJwtInternalPayload,
  InteropJwtConsumerPayload and InteropJwtApiPayload.
  This function serialize the "aud" in comma-separated string.
*/
export function toSerializedInteropJwtPayload(
  tokenPayload:
    | InteropJwtInternalPayload
    | InteropJwtConsumerPayload
    | InteropJwtApiPayload
): Exclude<SerializedAuthTokenPayload, SerializedInteropJwtUIPayload> {
  return {
    ...tokenPayload,
    aud: toJwtSerializedAudience(tokenPayload.aud),
  };
}

type SerializedAudience = {
  aud: string;
  // ^ aud is serialized as a string that can be a single string or a
  // string as comma-separated values
};

export type SerializedInteropJwtUIPayload = Omit<
  InteropJwtUIPayload,
  "user-roles" | "aud"
> & {
  "user-roles": string;
  // ^ user-roles is serialized as a comma-separated stringa
} & SerializedAudience;

// SerializedInteropJwtPayload represents the union of all JWT payloads
// with the "aud" field serialized as a string (possibly comma-separated).
export type SerializedInteropJwtInternalPayload = Omit<
  InteropJwtInternalPayload,
  "aud"
> &
  SerializedAudience;

export type SerializedInteropJwtApiPayload =
  | (Omit<InteropJwtApiM2MAdminPayload, "aud"> & SerializedAudience)
  | (Omit<InteropJwtApiM2MPayload, "aud"> & SerializedAudience);

export type SerializedInteropJwtConsumerPayload = Omit<
  InteropJwtConsumerPayload,
  "aud"
> &
  SerializedAudience;
