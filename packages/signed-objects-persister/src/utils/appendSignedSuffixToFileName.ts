import { match } from "ts-pattern";
import { FileKind, FileKindSchema } from "./fileKind.config.js";

export const appendSignedSuffixToFileName = (
  fileKey: string,
  fileKind: FileKind
): string => {
  const dotIndex = fileKey.lastIndexOf(".");

  if (dotIndex === -1) {
    return `${fileKey}-signed`;
  }

  const name = fileKey.slice(0, dotIndex);
  const ext = fileKey.slice(dotIndex);

  return match(fileKind)
    .with(
      FileKindSchema.Enum.EVENT_JOURNAL,
      () => `${name}-signed.json.zip.p7m`
    )
    .with(
      FileKindSchema.Enum.VOUCHER_AUDIT,
      () => `${name}-signed.ndjson.zip.p7m`
    )
    .otherwise(() => `${name}-signed${ext}`);
};
