import { MessageType } from "@protobuf-ts/runtime";
import { ZodAny, ZodTransformer, z } from "zod";

export function protobufDecoder<I extends object>(
  decoder: MessageType<I>
): ZodTransformer<ZodAny, I> {
  return z.any().transform((v) => decoder.fromBinary(Buffer.from(v, "hex")));
}
