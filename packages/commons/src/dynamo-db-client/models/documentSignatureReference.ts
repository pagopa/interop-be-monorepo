export interface DocumentSignatureReference {
  safeStorageId: string;
  fileKind: string;
  streamId: string;
  subObjectId: string;
  contentType: string;
  path: string;
  prettyname: string;
  fileName: string;
  version: number;
  createdAt: bigint;
  correlationId: string;
  creationTimestamp?: number;
}
