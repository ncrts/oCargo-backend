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
const languageDetectionMiddleware = require('../../utils/languageConverter').languageDetectionMiddleware;

const router = express.Router();


// router.post('/quiz-category/create', quizGameController.createCategory);
router.post('/quiz-category/create-multiple', quizGameController.createMultipleCategories);
router.get('/quiz-category', languageDetectionMiddleware, quizGameController.getCategory);

// Instant Quiz Creation
router.post('/quiz/instant', authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.createQuizInstant);

// Instant Quiz Update
router.patch('/quiz/instant/:id', authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.updateQuizInstant);

// Instant Quiz List
router.get('/quiz/instant/list', authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.getQuizInstantList);

// Quiz Question Creation
router.post('/quiz/question', authToken.franchiseeProtect, quizGameController.createQuizQuestion);

// Quiz Question Update
router.patch('/quiz/question/:id', authToken.franchiseeProtect, quizGameController.updateQuizQuestion);

// Quiz Question Delete
router.delete('/quiz/question/:id', authToken.franchiseeProtect, quizGameController.deleteQuizQuestion);

// Get Quiz Questions by Quiz ID
router.get('/quiz/questions', authToken.franchiseeProtect, quizGameController.getQuizQuestionsByQuizId);


// Quiz Game Session Routes
router.post('/quiz/game-session', authToken.franchiseeProtect, quizGameController.createQuizGameSession);

router.get('/quiz/game-session/:id', authToken.franchiseeProtect, quizGameController.getQuizGameSessionById);

router.get('/quiz/game-sessions', authToken.franchiseeProtect, quizGameController.getQuizGameSessions);

router.patch('/quiz/game-session/:id', authToken.franchiseeProtect, quizGameController.updateQuizGameSession);

router.delete('/quiz/game-session/:id', authToken.franchiseeProtect, quizGameController.deleteQuizGameSession);


// Quiz Game Session Player Routes
router.post('/quiz/game-session/join', authToken.playerProtect, quizGameController.joinQuizGameSession);

router.post('/quiz/game-session/answer', authToken.playerProtect, quizGameController.submitQuizAnswer);

router.post('/quiz/game-session/leave', authToken.playerProtect, quizGameController.leaveQuizGameSession);
router.get('/quiz/game-session/:sessionId/player/:clientId', authToken.playerProtect, quizGameController.getPlayerSessionData);

router.get('/quiz/game-session/:sessionId/players', authToken.playerProtect, quizGameController.getSessionLeaderboard);

// Points Calculation Route
router.post('/quiz/calculate-points', quizGameController.calculateQuestionPoints);

router.post('/quiz/player-response-answer', authToken.commonProtect, quizGameController.playerResponseAnswer);
router.post('/quiz/complete-questions-data', authToken.commonProtect, quizGameController.completeQuizGameSessionQuestionsData);

module.exports = router;