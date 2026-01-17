// Polyfill for URL.parse (required by PDF.js in some environments)
if (!URL.parse) {
    URL.parse = function (url, base) {
        try {
            return new URL(url, base);
        } catch {
            return null;
        }
    };
}

// Import the actual PDF.js worker
import './pdf.worker.min.mjs';
