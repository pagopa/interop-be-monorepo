import * as crypto from "crypto";
import { jwkDecodingError } from "../../../models/dist/errors.js";

export const decodeBase64ToPem = (base64String: string): string => {
  try {
    const cleanedBase64 = base64String.trim();
    const decodedBytes = Buffer.from(cleanedBase64, "base64");
    return `${decodedBytes.toString("utf-8")}`;
  } catch (error) {
    throw jwkDecodingError(error);
  }
};

export const isPublicKey = (pemKey: string): boolean =>
  pemKey.includes("PUBLIC");

export const calculateKid = (key: string): string =>
  crypto.createHash("sha256").update(key).digest("base64");
