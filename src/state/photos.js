// --- IndexedDB Storage for Test Photos ---
const DB_NAME = 'GradeTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'grade_photos';
let db = null;

function initDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            console.log('IndexedDB initialized successfully');
            resolve(db);
        };
        request.onerror = (e) => {
            console.error('IndexedDB initialization error:', e.target.error);
            resolve(null);
        };
    });
}

// Call initDB on startup (browser only — Node test runs have no IndexedDB)
if (typeof indexedDB !== 'undefined') {
    initDB();
}

function storePhoto(gradeId, base64Data) {
    return new Promise((resolve) => {
        if (!db) {
            console.warn('IndexedDB not ready, cannot store photo');
            resolve(false);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(base64Data, gradeId);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => {
                console.error('storePhoto error:', e.target.error);
                resolve(false);
            };
        } catch (err) {
            console.error('storePhoto transaction error:', err);
            resolve(false);
        }
    });
}

function getPhoto(gradeId) {
    return new Promise((resolve) => {
        if (!db) {
            resolve(null);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(gradeId);
            request.onsuccess = (e) => resolve(e.target.result || null);
            request.onerror = (e) => {
                console.error('getPhoto error:', e.target.error);
                resolve(null);
            };
        } catch (err) {
            console.error('getPhoto transaction error:', err);
            resolve(null);
        }
    });
}

function deletePhoto(gradeId) {
    return new Promise((resolve) => {
        if (!db) {
            resolve(false);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(gradeId);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => {
                console.error('deletePhoto error:', e.target.error);
                resolve(false);
            };
        } catch (err) {
            console.error('deletePhoto transaction error:', err);
            resolve(false);
        }
    });
}

/** Every stored photo as [{ gradeId, data }] — used by the backup export. */
function getAllPhotos() {
    return new Promise((resolve) => {
        if (!db) {
            resolve([]);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const photos = [];
            const request = store.openCursor();
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    photos.push({ gradeId: cursor.key, data: cursor.value });
                    cursor.continue();
                } else {
                    resolve(photos);
                }
            };
            request.onerror = (e) => {
                console.error('getAllPhotos error:', e.target.error);
                resolve([]);
            };
        } catch (err) {
            console.error('getAllPhotos transaction error:', err);
            resolve([]);
        }
    });
}

/** Vide toutes les photos stockées (suppression de compte). */
function clearAllPhotos() {
    return new Promise((resolve) => {
        if (!db) {
            resolve(false);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => {
                console.error('clearAllPhotos error:', e.target.error);
                resolve(false);
            };
        } catch (err) {
            console.error('clearAllPhotos transaction error:', err);
            resolve(false);
        }
    });
}

export { initDB, storePhoto, getPhoto, deletePhoto, getAllPhotos, clearAllPhotos };
