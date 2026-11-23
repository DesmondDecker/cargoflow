import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, JobStatus } from '../types';
import { getQueue, QueuedAction } from './queue';

// A copy of what the driver last saw from the server, so the Jobs and History
// tabs and job details still open with no signal. Pending offline actions are
// laid over it (see overlay) so an accepted job stays accepted on screen until
// the server confirms.
const OPEN_KEY = 'cargoflow_driver_cache_open';
const HISTORY_KEY = 'cargoflow_driver_cache_history';

async function readJobs(key: string): Promise<Job[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Job[]) : [];
  } catch {
    return [];
  }
}

export const saveOpenJobs = (jobs: Job[]) => AsyncStorage.setItem(OPEN_KEY, JSON.stringify(jobs));
export const saveHistoryJobs = (jobs: Job[]) => AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(jobs));
export const loadOpenJobs = () => readJobs(OPEN_KEY);
export const loadHistoryJobs = () => readJobs(HISTORY_KEY);

export async function clearJobCache(): Promise<void> {
  await AsyncStorage.multiRemove([OPEN_KEY, HISTORY_KEY]);
}

function statusAfter(action: QueuedAction): JobStatus {
  switch (action.kind) {
    case 'respond':
      return action.decision === 'accept' ? 'accepted' : 'declined';
    case 'status':
      return action.status;
    case 'complete':
      return 'delivered';
  }
}

const FINISHED: JobStatus[] = ['delivered', 'declined', 'cancelled'];

// Applies queued actions to a list of jobs, in the order they were made.
export function overlay(jobs: Job[], queue: QueuedAction[]): Job[] {
  const byId = new Map(jobs.map((j) => [j._id, { ...j }]));
  for (const action of queue) {
    const job = byId.get(action.jobId);
    if (job) job.status = statusAfter(action);
  }
  return Array.from(byId.values());
}

export async function openJobsWithPending(serverJobs: Job[]): Promise<Job[]> {
  return overlay(serverJobs, await getQueue()).filter((j) => !FINISHED.includes(j.status));
}

export async function findCachedJob(jobId: string): Promise<Job | undefined> {
  const [open, history, queue] = await Promise.all([loadOpenJobs(), loadHistoryJobs(), getQueue()]);
  const job = [...open, ...history].find((j) => j._id === jobId);
  return job ? overlay([job], queue)[0] : undefined;
}
