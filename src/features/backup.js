// --- Backup: JSON export / import ---
// All grades live in one browser. Before this feature, clearing site data
// (or Safari's 7-day eviction) meant losing everything. The export is a
// plain JSON file the student keeps; import replaces the current state
// after an explicit confirmation, with a pre-import snapshot as a net.
import { state, replaceState, STORAGE_KEY } from '../state/store.js';
import { getAllPhotos, storePhoto } from '../state/photos.js';
import { CURRENT_SCHEMA_VERSION } from '../state/migrations.js';
import { showSidebarToast } from '../ui/effects.js';

export const PREIMPORT_KEY = 'gymnase_vaud_state_preimport';

// --- pure helpers (unit-tested) ---

export function buildBackupObject(stateObj, photos) {
    const backup = {
        app: 'gradevibe',
        kind: 'backup',
        schemaVersion: stateObj.schemaVersion || CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        state: stateObj
    };
    if (photos && photos.length > 0) {
        backup.photos = photos;
    }
    return backup;
}

/**
 * Returns { ok: true } or { ok: false, reason } for a parsed backup file.
 */
export function validateBackupObject(obj, currentVersion = CURRENT_SCHEMA_VERSION) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, reason: 'not-an-object' };
    if (obj.app !== 'gradevibe' || obj.kind !== 'backup') return { ok: false, reason: 'not-a-gradevibe-backup' };
    if (!obj.state || typeof obj.state !== 'object' || Array.isArray(obj.state)) return { ok: false, reason: 'missing-state' };
    if ((obj.schemaVersion || 5) > currentVersion) return { ok: false, reason: 'newer-version' };
    if (obj.photos !== undefined && !Array.isArray(obj.photos)) return { ok: false, reason: 'bad-photos' };
    return { ok: true };
}

/** Counts for the import confirmation message. */
export function summarizeBackup(obj) {
    const s = obj.state || {};
    const lists = [s.subjectsYear1, s.subjectsYear2, s.subjectsYear3, s.subjectsYear1_rep, s.subjectsYear2_rep, s.subjectsYear3_rep].filter(Array.isArray);
    let subjects = 0;
    let grades = 0;
    for (const list of lists) {
        subjects += list.length;
        for (const sub of list) {
            if (sub.grades && !Array.isArray(sub.grades)) {
                grades += (sub.grades.sem1 || []).length + (sub.grades.sem2 || []).length;
            } else if (Array.isArray(sub.grades)) {
                grades += sub.grades.length;
            }
        }
    }
    return { subjects, grades, photos: (obj.photos || []).length, exportedAt: obj.exportedAt || null };
}

// --- browser-side flows ---

async function exportBackup(includePhotos) {
    const photos = includePhotos ? await getAllPhotos() : [];
    const backup = buildBackupObject(state, photos);
    const json = JSON.stringify(backup);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `notare-backup-${date}.json`;
    const file = new File([json], filename, { type: 'application/json' });

    // iOS standalone PWAs handle the share sheet ("Enregistrer dans
    // Fichiers") far better than a synthetic <a download> click.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'Sauvegarde Notare' });
            showSidebarToast('Sauvegarde exportée ✓', 'success');
            return;
        } catch (e) {
            if (e.name === 'AbortError') return; // user closed the sheet
            // fall through to the download link
        }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showSidebarToast('Sauvegarde téléchargée ✓', 'success');
}

async function importBackupFile(file) {
    let obj;
    try {
        obj = JSON.parse(await file.text());
    } catch (e) {
        showSidebarToast('Fichier illisible — ce n\'est pas une sauvegarde valide.', 'error');
        return;
    }

    const verdict = validateBackupObject(obj);
    if (!verdict.ok) {
        const msg = verdict.reason === 'newer-version'
            ? 'Cette sauvegarde vient d\'une version plus récente de l\'app. Mets à jour d\'abord.'
            : 'Ce fichier n\'est pas une sauvegarde Notare.';
        showSidebarToast(msg, 'error');
        return;
    }

    const { subjects, grades, photos, exportedAt } = summarizeBackup(obj);
    const when = exportedAt ? new Date(exportedAt).toLocaleDateString('fr-CH') : 'date inconnue';
    const confirmed = window.confirm(
        `Sauvegarde du ${when} : ${subjects} branches, ${grades} notes` +
        (photos ? `, ${photos} photos` : '') +
        `.\n\nRemplacer les données actuelles ?`
    );
    if (!confirmed) return;

    // Safety net: snapshot the current state before overwriting it.
    try {
        localStorage.setItem(PREIMPORT_KEY, localStorage.getItem(STORAGE_KEY) || '');
    } catch (e) { /* non-fatal */ }

    replaceState(obj.state);
    if (Array.isArray(obj.photos)) {
        for (const photo of obj.photos) {
            if (photo && photo.gradeId && photo.data) {
                await storePhoto(photo.gradeId, photo.data);
            }
        }
    }

    // Full reload: cleanest way to rebuild every view from the new state.
    location.reload();
}

/** Wires the Sauvegarde section in the settings modal. Called from init(). */
export function initBackupUI() {
    const exportBtn = document.getElementById('backup-export-btn');
    const includePhotosCheckbox = document.getElementById('backup-include-photos');
    const importBtn = document.getElementById('backup-import-btn');
    const importInput = document.getElementById('backup-import-input');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportBackup(!!(includePhotosCheckbox && includePhotosCheckbox.checked));
        });
    }
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', () => {
            const file = importInput.files && importInput.files[0];
            if (file) importBackupFile(file);
            importInput.value = '';
        });
    }
}
