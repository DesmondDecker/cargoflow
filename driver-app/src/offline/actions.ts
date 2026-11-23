import { enqueue, isNetworkError, NewAction, runAction } from './queue';

// How the screens do anything that changes a job. Online it just happens.
// With no signal it is saved on the phone and sent later; `queued: true`
// tells the screen to say so instead of pretending it went through.
export async function performAction(action: NewAction): Promise<{ queued: boolean }> {
  try {
    await runAction(action);
    return { queued: false };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await enqueue(action);
    return { queued: true };
  }
}
