/**
 * Immersive Learning local file store (IndexedDB)
 * Stores user-uploaded files on the user's device so workspaces can be resumed later.
 */

type StoredFileRecord = {
  userId: string;
  fileId: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
  createdAt: number;
};

const DB_NAME = "immersiveLearningFiles";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("by_user", "userId", { unique: false });
        store.createIndex("by_user_file", ["userId", "fileId"], { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        let request: IDBRequest<T> | void;
        try {
          request = fn(store);
        } catch (e) {
          reject(e);
          return;
        }

        if (request) {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }

        tx.oncomplete = () => {
          if (!request) resolve();
          db.close();
        };
        tx.onerror = () => {
          reject(tx.error);
          db.close();
        };
      })
  );
}

const makeKey = (userId: string, fileId: string) => `${userId}::${fileId}`;

export async function putImmersiveLearningFile(params: {
  userId: string;
  fileId: string;
  file: File;
}): Promise<void> {
  const { userId, fileId, file } = params;
  const record: StoredFileRecord & { key: string } = {
    key: makeKey(userId, fileId),
    userId,
    fileId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified || Date.now(),
    blob: file,
    createdAt: Date.now(),
  };

  await withStore("readwrite", (store) => store.put(record));
}

export async function getImmersiveLearningFile(params: {
  userId: string;
  fileId: string;
}): Promise<StoredFileRecord | null> {
  const { userId, fileId } = params;
  const result = (await withStore("readonly", (store) =>
    store.get(makeKey(userId, fileId))
  )) as (StoredFileRecord & { key: string }) | undefined;

  if (!result) return null;
  // strip internal key
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key: _key, ...rest } = result;
  return rest;
}

export async function deleteImmersiveLearningFile(params: {
  userId: string;
  fileId: string;
}): Promise<void> {
  const { userId, fileId } = params;
  await withStore("readwrite", (store) => store.delete(makeKey(userId, fileId)));
}


