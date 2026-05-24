import { ReviewQueueService } from '../../src/review/review-queue.service.js';

describe('ReviewQueueService integration', () => {
  it('gracefully disables queue when Redis is unavailable', async () => {
    const service = new ReviewQueueService();

    if (!service.isEnabled()) {
      await expect(service.enqueueReviewJob('test-job-id')).resolves.toBe(false);
      return;
    }

    await expect(service.enqueueReviewJob('test-job-id')).resolves.toBe(true);
  });
});
