type StoredWorkspaceRecord<T> = {
  key: string;
  userId: string;
  workspaceId: string;
  workspace: T;
  updatedAt: number;
};

const DB_NAME = 'immersiveLearningWorkspaces';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';

const makeKey = (userId: string, workspaceId: string) => `${userId}::${workspaceId}`;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('by_user', 'userId', { unique: false });
        store.createIndex('by_user_workspace', ['userId', 'workspaceId'], { unique: true });
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
        } catch (error) {
          reject(error);
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

export async function putImmersiveLearningWorkspace<T extends { id: string }>(params: {
  userId: string;
  workspace: T;
}): Promise<void> {
  const { userId, workspace } = params;
  const record: StoredWorkspaceRecord<T> = {
    key: makeKey(userId, workspace.id),
    userId,
    workspaceId: workspace.id,
    workspace,
    updatedAt: Date.now(),
  };

  await withStore('readwrite', (store) => store.put(record));
}

export async function getImmersiveLearningWorkspace<T>(params: {
  userId: string;
  workspaceId: string;
}): Promise<T | null> {
  const { userId, workspaceId } = params;
  const result = (await withStore('readonly', (store) =>
    store.get(makeKey(userId, workspaceId))
  )) as StoredWorkspaceRecord<T> | undefined;

  return result?.workspace ?? null;
}

export async function listImmersiveLearningWorkspaces<T>(params: { userId: string }): Promise<T[]> {
  const { userId } = params;
  const result = (await withStore('readonly', (store) =>
    store.index('by_user').getAll(userId)
  )) as StoredWorkspaceRecord<T>[] | undefined;

  return (result ?? []).map((record) => record.workspace);
}

export async function deleteImmersiveLearningWorkspace(params: {
  userId: string;
  workspaceId: string;
}): Promise<void> {
  const { userId, workspaceId } = params;
  await withStore('readwrite', (store) => store.delete(makeKey(userId, workspaceId)));
}
