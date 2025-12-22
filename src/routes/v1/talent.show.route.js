const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights');

const { userProfileUpload } = require('../../filesuploder/user.files');
const commonController = require('../../controllers/apis/common.controller');
const quizGameController = require('../../controllers/apis/quizGame.controller');
const playerController = require('../../controllers/apis/player.controller');
const playerValidation = require('../../validations/player.validation');
const languageDetectionMiddleware = require('../../utils/languageConverter').languageDetectionMiddleware;

const router = express.Router();

const talentShowController = require('../../controllers/apis/talent.show.controller');


// POST /v1/talent-show/session
router.post('/session', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.createTalentShowSession);

// PUT /v1/talent-show/session/:id/details
router.put('/session/:id/details', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.updateTalentShowSessionDetails);

// PATCH /v1/talent-show/session/:id
router.patch('/session/:id', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.updateTalentShowSession);

// GET /v1/talent-show/sessions
router.get('/sessions', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.getTalentShowSessionsList);

// GET /v1/talent-show/session/:id/details
router.get('/session/:id/details', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.getTalentShowSessionDetails);

// GET /v1/talent-show/session/:sessionId/participants-details
router.get('/session/:sessionId/participants-details', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.getParticipantDetailsWithRounds);

// PUT /v1/talent-show/session/:sessionId/participants/sequences
router.put('/session/:sessionId/participants/sequences', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.bulkUpdateParticipantSequence);

// POST /v1/talent-show/session/:id/join-participant
router.post('/session/:id/join-participant', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.joinTalentShowAsParticipant);

// PATCH /v1/talent-show/participant/:joinId
router.patch('/session/participant/:joinId', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.updateTalentShowParticipant);

// DELETE /v1/talent-show/participant/:joinId
router.delete('/session/participant/:joinId', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.deleteParticipant);

// DELETE /v1/talent-show/jury/:joinId
router.delete('/session/jury/:joinId', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.deleteJury);

// POST /v1/talent-show/session/join-jury
router.post('/session/:id/join-jury', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.joinTalentShowAsJuryFromWeb);

// POST /v1/talent-show/session/join-mobile (for mobile app join by pin/qr)
router.post('/session/join-mobile', authToken.playerProtect, languageDetectionMiddleware, talentShowController.joinTalentShowByPinOrQr);

router.post('/session/manage-voter-on-off', authToken.commonProtectForFranchiseeAndFranchisor, talentShowController.manageVoteOnOffAftherCompleteRounds);

router.post('/session/change-talent-round', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.changedTalentRound);

router.post('/session/score-board', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.scoreBoard);

router.post('/session/performer-history', authToken.commonProtect, languageDetectionMiddleware, talentShowController.talentShowPerformerHistory);

router.post('/session/talent-history', authToken.commonProtect, languageDetectionMiddleware, talentShowController.talentShowFranchiseeHistory);

router.post('/session/disqualify-participant', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.disqualifyParticipant);

// POST /v1/talent-show/badges/bulk-insert
router.post('/badges/bulk-insert', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.bulkInsertTalentBadges);

module.exports = router;