// Historial persistente en el navegador (IndexedDB). Sin servidor ni cuentas:
// cada navegador guarda lo suyo. Si IndexedDB no está disponible (modo privado,
// datos bloqueados), todo sigue funcionando solo en memoria.

const DB_NAME = "coralgorgona";
const DB_VERSION = 1;
const STORE = "history";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!("indexedDB" in window)) return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(STORE, mode);
          const out = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(out?.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        } catch (err) {
          reject(err);
        }
      })
  );
}

export async function storeAvailable() {
  return !!(await openDb());
}

export async function loadAllEntries() {
  try {
    const all = (await run("readonly", (s) => s.getAll())) || [];
    return all.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch (err) {
    console.warn("No se pudo leer el historial guardado:", err);
    return [];
  }
}

function isQuotaError(err) {
  return err && (err.name === "QuotaExceededError" || err.code === 22);
}

// Guarda una entrada. Si no hay espacio, borra las más antiguas de `allEntries`
// (ordenadas de más nueva a más antigua) hasta que quepa. Devuelve los ids borrados.
export async function putEntry(entry, allEntries = []) {
  const evicted = [];
  const candidates = allEntries.filter((e) => e.id !== entry.id);
  for (;;) {
    try {
      await run("readwrite", (s) => s.put(entry));
      return evicted;
    } catch (err) {
      if (!isQuotaError(err) || !candidates.length) {
        console.warn("No se pudo guardar en el historial:", err);
        return evicted;
      }
      const oldest = candidates.pop();
      await deleteEntry(oldest.id);
      evicted.push(oldest.id);
    }
  }
}

export async function deleteEntry(id) {
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch (err) {
    console.warn("No se pudo borrar del historial:", err);
  }
}

export async function clearEntries() {
  try {
    await run("readwrite", (s) => s.clear());
  } catch (err) {
    console.warn("No se pudo limpiar el historial:", err);
  }
}
