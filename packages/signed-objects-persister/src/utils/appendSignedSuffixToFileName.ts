import path from "path";
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
      () =>
        // Since EVENT_JOURNAL has double extension (.ndjson.zip) we need to remove the remaining extension
        `${path.parse(name).name}.json.zip.p7m`
    )
    .with(FileKindSchema.Enum.VOUCHER_AUDIT, () => `${name}.ndjson.zip.p7m`)
    .otherwise(() => `${name}${ext}`);
};
