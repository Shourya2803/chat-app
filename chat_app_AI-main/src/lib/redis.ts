import Redis from 'ioredis';

const getRedisUrl = () => {
    if (process.env.REDIS_URL) return process.env.REDIS_URL;
    if (process.env.KV_URL) return process.env.KV_URL;
    return undefined;
}

const redisUrl = getRedisUrl();

export const redis = redisUrl ? new Redis(redisUrl) : null;

if (!redisUrl) {
    console.warn("⚠️ Redis URL not found in environment variables. Caching disabled.");
} else {
    console.log("✅ Redis Client initialized");
}
