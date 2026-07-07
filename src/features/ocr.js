// --- OCR helpers: grade verification + photo compression (pure utils) ---

function verifyGradeInText(ocrText, gradeValue) {
    if (!ocrText) return false;
    const normalized = ocrText.toLowerCase().replace(/[,;]/g, '.').replace(/\s+/g, ' ');
    const valStr = gradeValue.toFixed(1);
    const valInt = Math.floor(gradeValue).toString();
    
    if (normalized.includes(valStr)) return true;
    if (gradeValue % 1 === 0) {
        const regex = new RegExp(`\\b${valInt}\\b`);
        if (regex.test(normalized)) return true;
    }
    return false;
}

function compressAndResizeImage(dataUrl, maxWidth = 800, maxHeight = 800, quality = 0.75) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
}

export { verifyGradeInText, compressAndResizeImage };
