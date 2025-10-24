// TO DO REMOVE ONCE DOCUMENT-SIGNER MERGED
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
  creationTimestamp?: number;
}
