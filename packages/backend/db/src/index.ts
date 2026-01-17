export * from './core.js';
export * from './schema/index.js';
import * as schema from './schema/index.js';
export { schema };

// Export services
export * from './services/students.js';
export * from './services/progress.js';

// Export Drizzle utilities
export { eq, and, or, sql, desc, asc } from 'drizzle-orm';
