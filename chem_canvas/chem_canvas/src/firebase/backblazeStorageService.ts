// @ts-nocheck
// Stub implementation for Backblaze storage to satisfy TypeScript during builds.
export interface StoredDocument {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  size?: number;
}

export async function uploadFileToBackblazeAndRecord(file: File): Promise<StoredDocument> {
  return {
    id: file.name,
    name: file.name,
    url: '',
    uploadedAt: new Date().toISOString(),
    size: file.size
  };
}
