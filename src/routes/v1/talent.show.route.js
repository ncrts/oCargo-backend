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

// PATCH /v1/talent-show/session/:id
router.patch('/session/:id', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.updateTalentShowSession);

// GET /v1/talent-show/sessions
router.get('/sessions', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.getTalentShowSessionsList);

// POST /v1/talent-show/session/:id/join-participant
router.post('/session/:id/join-participant', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.joinTalentShowAsParticipant);

// POST /v1/talent-show/session/join-jury
router.post('/session/:id/join-jury', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.joinTalentShowAsJuryFromWeb);

// POST /v1/talent-show/session/join-mobile (for mobile app join by pin/qr)
router.post('/session/join-mobile', authToken.playerProtect, languageDetectionMiddleware, talentShowController.joinTalentShowByPinOrQr);

router.post('/session/manage-voter-on-off', authToken.commonProtectForFranchiseeAndFranchisor, talentShowController.manageVoteOnOffAftherCompleteRounds);

router.post('/session/change-talent-round', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.changedTalentRound);

router.post('/session/score-board', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.scoreBoard);

router.post('/session/performer-history', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.talentShowPerformerHistory);

router.post('/session/talent-history', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.talentShowFranchiseeHistory);

router.post('/session/disqualify-participant', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.disqualifyParticipant);

// POST /v1/talent-show/badges/bulk-insert
router.post('/badges/bulk-insert', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.bulkInsertTalentBadges);

module.exports = router;