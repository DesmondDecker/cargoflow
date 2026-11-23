import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import { exportContainersCsv, exportExpensesCsv, fetchLatestDigest, getReportSummary, runDigestNow } from '../controllers/reportController';

const router = Router();
router.use(requireAgencyAuth);

router.get('/daily-digest', fetchLatestDigest);
router.post('/daily-digest/run', runDigestNow);
router.get('/summary', getReportSummary);
router.get('/containers.csv', exportContainersCsv);
router.get('/expenses.csv', exportExpensesCsv);

export default router;
