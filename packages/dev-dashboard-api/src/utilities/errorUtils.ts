export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
