import { Worker } from 'bullmq'
import { bullmqConnection } from '../../lib/bullmq'
import { orderItemsRepository } from '../orders/order-items.repository'
import { emitToRoom } from '../../lib/socket'

interface ReminderJobData {
  itemId: string
  waiterId: string
  payload: Record<string, unknown>
}

export function startNotificationsWorker() {
  const worker = new Worker<ReminderJobData>(
    'pickup-reminders',
    async (job) => {
      const { itemId, waiterId, payload } = job.data

      // Re-notify only if item is still 'ready' (not served yet)
      const item = await orderItemsRepository.findById(itemId)
      if (!item || item.status !== 'ready') return

      emitToRoom(`room:waiter:${waiterId}`, 'order:item:ready', {
        ...payload,
        isReminder: true,
      })
    },
    { connection: bullmqConnection }
  )

  // Worker-level logging — outside Fastify request context, process logger is appropriate
  worker.on('failed', (job, err) => {
    process.stderr.write(`[Worker] Reminder job ${job?.id ?? '?'} failed: ${err.message}\n`)
  })

  return worker
}