import {
  InteropJwtApiM2MAdminPayload,
  InteropJwtApiM2MPayload,
  InteropJwtApiPayload,
  InteropJwtConsumerPayload,
  InteropJwtInternalPayload,
  InteropJwtUIPayload,
  InteropJwtApiM2MDPoPPayload,
  InteropJwtApiM2MAdminDPoPPayload,
} from "./models.js";

// ===========================================
//    Auth tokens payloads
// serialization types and utilities
// ===========================================
/*
  Serializations are used only in the generation phase in IteroptokenService, 
  zod doesn't offer a valid encoder function to serialize the payload,  
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
function toCommaSeparatedString<T extends string>(input: T[]): string {
  return input.join(",");
}

/*
  Serialize the payload of the Interop UI JWT, the "aud", "user-roles" 
  are serialized in a comma-separated string.
*/
export function toSerializedJwtUIPayload(
  tokenPayload: InteropJwtUIPayload
): SerializedInteropJwtUIPayload {
  return {
    ...tokenPayload,
    "user-roles": toCommaSeparatedString(tokenPayload["user-roles"]),
    aud: toCommaSeparatedString(tokenPayload.aud),
  };
}

/* 
  This function is used to serialize the payload of the Interop JWTs.
  At the moment, interopTokenService only generates the InteropJwtInternalPayload,
  InteropJwtConsumerPayload, InteropJwtApiPayload, and InteropJwtUIPayload.
  InteropJwtUIPayload has a dedicated serializer above, so this function accepts the other three and serializes the "aud" in a comma-separated string.
*/
export function toSerializedInteropJwtPayload(
  tokenPayload:
    | InteropJwtInternalPayload
    | InteropJwtConsumerPayload
    | InteropJwtApiPayload
): Exclude<SerializedAuthTokenPayload, SerializedInteropJwtUIPayload> {
  return {
    ...tokenPayload,
    aud: toCommaSeparatedString(tokenPayload.aud),
  };
}

type SerializedAudience = {
  aud: string;
  // ^ aud is serialized as a comma-separated string
};

export type SerializedInteropJwtUIPayload = Omit<
  InteropJwtUIPayload,
  "user-roles" | "aud"
> & {
  "user-roles": string;
  // ^ user-roles is serialized as a comma-separated string
} & SerializedAudience;

export type SerializedInteropJwtInternalPayload = Omit<
  InteropJwtInternalPayload,
  "aud"
> &
  SerializedAudience;

export type SerializedInteropJwtApiPayload =
  | (Omit<InteropJwtApiM2MAdminPayload, "aud"> & SerializedAudience)
  | (Omit<InteropJwtApiM2MPayload, "aud"> & SerializedAudience)
  | (Omit<InteropJwtApiM2MDPoPPayload, "aud"> & SerializedAudience)
  | (Omit<InteropJwtApiM2MAdminDPoPPayload, "aud"> & SerializedAudience);

export type SerializedInteropJwtConsumerPayload = Omit<
  InteropJwtConsumerPayload,
  "aud"
> &
  SerializedAudience;
