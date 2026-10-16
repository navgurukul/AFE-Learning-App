import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcPath = path.join(rootDir, 'apps/desktop/src/preload/secure.cjs');
const destDir = path.join(rootDir, 'apps/desktop/dist/preload');
const destPath = path.join(destDir, 'secure.cjs');

try {
    if (!fs.existsSync(srcPath)) {
        console.error(`[Preload] Source file not found: ${srcPath}`);
        process.exit(1);
    }
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log(`[Preload] Synchronized secure.cjs -> ${destPath}`);
} catch (error) {
    console.error(`[Preload] Failed to copy preload script:`, error);
    process.exit(1);
}
