// lib/localCache.ts
import { openDB, DBSchema } from 'idb';

interface MyDB extends DBSchema {
  collections: {
    key: string;
    value: any[];
  };
  pending: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'MasterPOSCache';
const DB_VERSION = 1;

async function getDB() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('collections')) {
        db.createObjectStore('collections');
      }
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id' });
      }
    },
  });
}

export const localCache = {
  async saveCollection(name: string, data: any[]) {
    const db = await getDB();
    await db.put('collections', data, name);
  },
  async getCollection(name: string): Promise<any[]> {
    const db = await getDB();
    return (await db.get('collections', name)) || [];
  },
  async savePendingOperation(op: any) {
    const db = await getDB();
    await db.add('pending', op);
  },
  async getAllPending(): Promise<any[]> {
    const db = await getDB();
    return await db.getAll('pending');
  },
  async deletePending(id: string) {
    const db = await getDB();
    await db.delete('pending', id);
  },
  async clearPending() {
    const db = await getDB();
    const all = await db.getAll('pending');
    for (const op of all) {
      await db.delete('pending', op.id);
    }
  }
};