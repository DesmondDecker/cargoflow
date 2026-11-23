import { Router } from 'express';
import { requireAgencyAuth } from '../middleware/auth';
import { requireInstitutionAuth } from '../middleware/institutionAuth';
import { auditInstitutionActions } from '../middleware/auditInstitution';
import * as ctrl from '../controllers/customsController';

// Who can do what in the customs-verification workflow:
//   clearing agent (agency app)  submit, see their own agency's records, correct a returned one
//   Customs (portal)             review queue, approve / return, enter a record for an agent
//   Customs and AGL (portal)     approved records, CSV export, reports (AGL: read-only)
const router = Router();
// Everything a Customs/AGL user does here is written to the supervisors' oversight log.
router.use(auditInstitutionActions);

// Agent side
router.post('/submissions', requireAgencyAuth, ctrl.createSubmission);
router.get('/submissions', requireAgencyAuth, ctrl.listMySubmissions);
router.get('/submissions/:id', requireAgencyAuth, ctrl.getMySubmission);
router.patch('/submissions/:id', requireAgencyAuth, ctrl.resubmit);

// Customs review
router.get('/queue', requireInstitutionAuth('customs'), ctrl.listQueue);
router.post('/queue', requireInstitutionAuth('customs'), ctrl.createAssisted);
router.get('/queue/:id', requireInstitutionAuth('customs'), ctrl.getQueueItem);
router.post('/queue/:id/approve', requireInstitutionAuth('customs'), ctrl.approve);
router.post('/queue/:id/return', requireInstitutionAuth('customs'), ctrl.returnSubmission);
router.post('/queue/:id/resend-email', requireInstitutionAuth('customs'), ctrl.resendEmail);

// Approved records, read-only for AGL
router.get('/approved.csv', requireInstitutionAuth('customs', 'agl'), ctrl.exportApprovedCsv);
router.get('/approved', requireInstitutionAuth('customs', 'agl'), ctrl.listApproved);
router.get('/approved/:id', requireInstitutionAuth('customs', 'agl'), ctrl.getApproved);
router.get('/reports/summary', requireInstitutionAuth('customs', 'agl'), ctrl.reportSummary);

export default router;
