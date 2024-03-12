import { InternalError } from "pagopa-interop-models";

const fileManagerErrorCodes = {
  fileManagerCopyError: "10001",
  fileManagerDeleteError: "10002",
  fileManagerListFilesError: "10003",
  fileManagerStoreBytesError: "10004",
} as const;
type FileManagerErrorCodes = keyof typeof fileManagerErrorCodes;

export class FileManagerError extends InternalError<FileManagerErrorCodes> {
  constructor({
    code,
    detail,
  }: {
    code: FileManagerErrorCodes;
    detail: string;
  }) {
    super({ code, detail });
  }
}

function printError(error: unknown): string {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

export function fileManagerCopyError(
  filePathToCopy: string,
  key: string,
  error: unknown
): FileManagerError {
  return new FileManagerError({
    code: "fileManagerCopyError",
    detail: `Error copying file ${filePathToCopy} to ${key}: ${printError(
      error
    )}`,
  });
}

export function fileManagerDeleteError(
  path: string,
  bucket: string,
  error: unknown
): FileManagerError {
  return new FileManagerError({
    code: "fileManagerDeleteError",
    detail: `Error deleting file ${path} from bucket ${bucket}: ${printError(
      error
    )}`,
  });
}

export function fileManagerListFilesError(bucket: string): FileManagerError {
  return new FileManagerError({
    code: "fileManagerListFilesError",
    detail: `Error listing files in bucket ${bucket}`,
  });
}

export function fileManagerStoreBytesError(
  key: string,
  bucket: string,
  error: unknown
): FileManagerError {
  return new FileManagerError({
    code: "fileManagerStoreBytesError",
    detail: `Error storing file ${key} in bucket ${bucket}: ${printError(
      error
    )}`,
  });
}
