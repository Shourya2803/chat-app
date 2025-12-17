import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../database/redis';
import { aiService, ToneType } from '../services/ai.service';
import { messageService } from '../services/message.service';
import { notificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { Server } from 'socket.io';

interface MessageJobData {
  messageId?: string;
  senderId: string;
  receiverId: string;
  content: string;
  toneType?: ToneType;
  applyTone: boolean;
  mediaUrl?: string;
  conversationId?: string;
}

export class MessageQueue {
  private queue: Queue<MessageJobData>;
  private worker: Worker<MessageJobData>;
  private io?: Server;

  constructor() {
    // Initialize queue
    this.queue = new Queue<MessageJobData>('message-processing', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Initialize worker
    this.worker = new Worker<MessageJobData>(
      'message-processing',
      async (job: Job<MessageJobData>) => this.processMessage(job),
      {
        connection: redis,
        concurrency: 10,
      }
    );

    this.setupWorkerListeners();
  }

  setSocketIO(io: Server) {
    this.io = io;
  }

  async addMessage(data: MessageJobData): Promise<Job<MessageJobData>> {
    try {
      const job = await this.queue.add('process-message', data, {
        priority: data.applyTone ? 2 : 1, // Prioritize tone-applied messages
      });

      logger.info('Message job added to queue', { jobId: job.id, senderId: data.senderId });
      return job;
    } catch (error) {
      logger.error('Failed to add message to queue', { error, data });
      throw error;
    }
  }

  private async processMessage(job: Job<MessageJobData>): Promise<void> {
    const { data } = job;
    
    try {
      logger.info('Processing message job', { jobId: job.id, senderId: data.senderId });

      let finalContent = data.content;
      let originalContent: string | undefined;
      let toneApplied: ToneType | undefined;

      // Apply AI tone conversion if requested
      if (data.applyTone && data.toneType) {
        await job.updateProgress(25);
        
        const toneResult = await aiService.convertTone(data.content, data.toneType);
        
        if (toneResult.success && toneResult.convertedText) {
          finalContent = toneResult.convertedText;
          originalContent = data.content;
          toneApplied = data.toneType;
          logger.info('Tone conversion applied', { 
            jobId: job.id, 
            tone: data.toneType,
            originalLength: data.content.length,
            convertedLength: finalContent.length
          });
        } else {
          logger.warn('Tone conversion failed, using original message', { 
            jobId: job.id, 
            error: toneResult.error 
          });
        }
      }

      await job.updateProgress(50);

      // Save message to database
      const message = await messageService.createMessage({
        conversationId: data.conversationId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: finalContent,
        originalContent,
        messageType: data.mediaUrl ? 'image' : 'text',
        mediaUrl: data.mediaUrl,
        toneApplied,
      });

      await job.updateProgress(75);

      // Emit via Socket.IO
      if (this.io) {
        this.io.to(data.receiverId).emit('new-message', message);
        this.io.to(data.senderId).emit('message-sent', message);
      }

      // Send push notification if user is offline
      await notificationService.sendMessageNotification(
        data.receiverId,
        data.senderId,
        message.conversation_id
      );

      await job.updateProgress(100);
      logger.info('Message processed successfully', { 
        jobId: job.id, 
        messageId: message.id 
      });
    } catch (error) {
      logger.error('Failed to process message', { 
        jobId: job.id, 
        error,
        data 
      });
      throw error;
    }
  }

  private setupWorkerListeners(): void {
    this.worker.on('completed', (job) => {
      logger.info('Job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Job failed', { 
        jobId: job?.id, 
        error: err.message,
        attempts: job?.attemptsMade 
      });
    });

    this.worker.on('error', (err) => {
      logger.error('Worker error', { error: err });
    });
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}

export const messageQueue = new MessageQueue();
