// Redis services removed from frontend. Use backend APIs for presence, typing, caching, and unread counts.
// Keep this file as a harmless module that provides stubs so TypeScript/ES imports resolve cleanly.

export function getRedisClient(): never {
	throw new Error('Redis services removed from frontend - use backend APIs');
}

export function subscribeToChannel(): never {
	throw new Error('Redis services removed from frontend - use backend APIs');
}

export const isRedisAvailable = false;
