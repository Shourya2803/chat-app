import { messageQueue } from './message.queue';
import { logger } from '../utils/logger';

async function startWorkers() {
  try {
    logger.info('Starting BullMQ workers...');
    
    // Message queue is initialized on import
    logger.info('Message queue worker started');

    // Get initial stats
    const stats = await messageQueue.getQueueStats();
    logger.info('Queue stats:', stats);

    logger.info('All workers started successfully');
  } catch (error) {
    logger.error('Failed to start workers', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down workers...');
  await messageQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down workers...');
  await messageQueue.close();
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  startWorkers();
}

export { messageQueue };
