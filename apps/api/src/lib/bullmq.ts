import { Queue } from 'bullmq'
import IORedis from 'ioredis'

// BullMQ requires maxRetriesPerRequest: null (different from the regular ioredis client)
export const bullmqConnection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

// Queue for pickup reminder re-notifications (3 min delay by default)
export const pickupReminderQueue = new Queue('pickup-reminders', {
  connection: bullmqConnection,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
})