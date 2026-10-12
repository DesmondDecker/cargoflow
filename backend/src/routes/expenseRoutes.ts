import { Router } from 'express';
import { requireAgencyAuth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/expenseController';

const router = Router();
router.use(requireAgencyAuth);

router.post('/', ctrl.createExpense);
router.get('/', ctrl.listExpenses);
router.post('/upload-url', ctrl.getExpenseUploadUrl);
// Approval is an owner/admin action — a staff member can record an expense
// but not sign off on their own or anyone else's (see expenseController's
// own comment on this).
router.post('/:id/approve', requireRole('owner', 'admin'), ctrl.approveExpense);
router.post('/:id/reject', requireRole('owner', 'admin'), ctrl.rejectExpense);

export default router;
