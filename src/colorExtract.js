// ============================================
// Dominant Color Extraction
// Extracts dominant colors from images using canvas
// For the Apple TV-like ambient background effect
// ============================================

const colorCache = new Map();

/**
 * Extract dominant color from an image URL
 * Returns { r, g, b } or null if extraction fails
 */
export function extractDominantColor(imgUrl) {
    return new Promise((resolve) => {
        if (!imgUrl) {
            resolve(null);
            return;
        }

        // Check cache
        if (colorCache.has(imgUrl)) {
            resolve(colorCache.get(imgUrl));
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const size = 32; // Small sample for performance
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, 0, 0, size, size);

                const imageData = ctx.getImageData(0, 0, size, size);
                const data = imageData.data;

                // Color buckets for simple quantization
                const buckets = {};
                let maxCount = 0;
                let dominant = { r: 60, g: 60, b: 100 }; // Fallback

                for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a < 128) continue; // Skip transparent

                    // Skip very dark or very light pixels
                    const brightness = (r + g + b) / 3;
                    if (brightness < 20 || brightness > 235) continue;

                    // Quantize colors to reduce noise (bucket to nearest 32)
                    const qr = Math.round(r / 32) * 32;
                    const qg = Math.round(g / 32) * 32;
                    const qb = Math.round(b / 32) * 32;
                    const key = `${qr},${qg},${qb}`;

                    buckets[key] = (buckets[key] || 0) + 1;

                    if (buckets[key] > maxCount) {
                        maxCount = buckets[key];
                        dominant = { r: qr, g: qg, b: qb };
                    }
                }

                // Boost saturation slightly for a more vivid ambient effect
                const result = boostSaturation(dominant, 1.3);
                colorCache.set(imgUrl, result);
                resolve(result);
            } catch {
                resolve(null);
            }
        };

        img.onerror = () => resolve(null);

        // Timeout safety
        setTimeout(() => resolve(null), 3000);

        img.src = imgUrl;
    });
}

/**
 * Boost saturation of an RGB color
 */
function boostSaturation({ r, g, b }, factor) {
    const avg = (r + g + b) / 3;
    return {
        r: Math.min(255, Math.round(avg + (r - avg) * factor)),
        g: Math.min(255, Math.round(avg + (g - avg) * factor)),
        b: Math.min(255, Math.round(avg + (b - avg) * factor)),
    };
}

/**
 * Generate CSS gradient string from dominant color
 */
export function colorToAmbientGradient(color) {
    if (!color) {
        return 'radial-gradient(circle at 50% 10%, rgba(76, 29, 149, 0.15), transparent 60%), radial-gradient(circle at 90% 90%, rgba(29, 78, 216, 0.1), transparent 60%)';
    }
    const { r, g, b } = color;
    return `radial-gradient(ellipse at 30% 20%, rgba(${r},${g},${b},0.25) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(${r},${g},${b},0.15) 0%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(${r},${g},${b},0.08) 0%, transparent 70%)`;
}

/**
 * Generate a complementary secondary color
 */
export function getSecondaryColor(color) {
    if (!color) return { r: 29, g: 78, b: 216 };
    return {
        r: 255 - color.r,
        g: 255 - color.g,
        b: 255 - color.b,
    };
}
