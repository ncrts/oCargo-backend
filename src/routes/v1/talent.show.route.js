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

// POST /v1/talent-show/session/:id/join
router.post('/session/:id/join', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, talentShowController.joinTalentShow);


module.exports = router;