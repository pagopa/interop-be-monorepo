import { jwkDecodingError } from "../../../models/dist/errors.js";

export const decodeBase64ToPem = (base64String: string): string => {
  try {
    // Rimuovi eventuali spazi o caratteri di nuova riga dalla stringa Base64
    const cleanedBase64 = base64String.trim();
    // Decodifica la stringa Base64
    const decodedBytes = Buffer.from(cleanedBase64, "base64");
    // Formatta i byte decodificati come PEM
    return `${decodedBytes.toString("utf-8")}`;
  } catch (error) {
    throw jwkDecodingError(error);
  }
};
