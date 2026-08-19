import { evaluateAllOrganizationsSla } from '../services/slaService';

let workerIntervalTimer: NodeJS.Timeout | null = null;
let isCycleRunning = false;

export const runSlaWorkerCycle = async () => {
  if (isCycleRunning) return null;
  isCycleRunning = true;
  try {
    const result = await evaluateAllOrganizationsSla();
    return result;
  } catch (error) {
    console.error('[SLA Worker] Periodic evaluation error:', (error as Error).message);
    return null;
  } finally {
    isCycleRunning = false;
  }
};

export const startSlaEvaluationWorker = (intervalMs: number = 60000): NodeJS.Timeout => {
  if (workerIntervalTimer) return workerIntervalTimer;
  workerIntervalTimer = setInterval(() => {
    void runSlaWorkerCycle();
  }, intervalMs);
  if (workerIntervalTimer.unref) workerIntervalTimer.unref();
  return workerIntervalTimer;
};

export const stopSlaEvaluationWorker = (): void => {
  if (workerIntervalTimer) {
    clearInterval(workerIntervalTimer);
    workerIntervalTimer = null;
  }
};
