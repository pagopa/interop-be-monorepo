import path from "node:path";
import { match } from "ts-pattern";
import { FileKind, FileKindSchema } from "./fileKind.config.js";

export const appendSignedSuffixToFileName = (
  fileKey: string,
  fileKind: FileKind,
  fileName: string
): string => {
  const ext = path.extname(fileKey);
  const { name } = path.parse(fileName);

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
