import * as path from 'path';
import * as fs from 'fs';

/**
 * Utility class for scraping operations.
 * Provides helper methods for reading and managing scraping scripts.
 */
export class ScrapingUtils {
    /**
     * Read a JavaScript script file from the scripts directory.
     * @param scriptPath - Relative path to the script file (e.g., 'scripts/fetchImageAsBase64.js')
     * @returns The script content as a string
     */
    static readScript(scriptPath: string): string {
        return fs.readFileSync(path.resolve(__dirname, '..', scriptPath), 'utf8');
    }
}
