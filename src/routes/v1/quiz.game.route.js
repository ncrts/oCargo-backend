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


// router.post('/quiz-category/create', quizGameController.createCategory);
router.post('/quiz-category/create-multiple', languageDetectionMiddleware, quizGameController.createMultipleCategories);
router.get('/quiz-category', languageDetectionMiddleware, quizGameController.getCategory);

// Instant Quiz Creation
router.post('/quiz/instant', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.createQuizInstant);

// Instant Quiz Update
router.patch('/quiz/instant/:id', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.updateQuizInstant);

// Instant Quiz List
router.get('/quiz/instant/list', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.getQuizInstantList);

// Quiz Question Creation
router.post('/quiz/question', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.createQuizQuestion);

// Quiz Question Update
router.patch('/quiz/question/:id', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.updateQuizQuestion);

// Quiz Question Delete
router.delete('/quiz/question/:id', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.deleteQuizQuestion);

// Get Quiz Questions by Quiz ID
router.get('/quiz/questions', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.getQuizQuestionsByQuizId);


// Quiz Game Session Routes
router.post('/quiz/game-session', languageDetectionMiddleware, authToken.commonProtectForFranchiseeAndFranchisor, quizGameController.createQuizGameSession);

router.get('/quiz/game-session/:id', languageDetectionMiddleware, authToken.franchiseeProtect, quizGameController.getQuizGameSessionById);

router.get('/quiz/game-sessions', languageDetectionMiddleware, authToken.franchiseeProtect, quizGameController.getQuizGameSessions);

router.patch('/quiz/game-session/:id', languageDetectionMiddleware, authToken.franchiseeProtect, quizGameController.updateQuizGameSession);

router.delete('/quiz/game-session/:id', languageDetectionMiddleware, authToken.franchiseeProtect, quizGameController.deleteQuizGameSession);


// Quiz Game Session Player Routes
router.post('/quiz/game-session/join', languageDetectionMiddleware, authToken.playerProtect, quizGameController.joinQuizGameSession);

router.post('/quiz/game-session/answer', languageDetectionMiddleware, authToken.playerProtect, quizGameController.submitQuizAnswer);

router.post('/quiz/game-session/leave', languageDetectionMiddleware, authToken.playerProtect, quizGameController.leaveQuizGameSession);
router.get('/quiz/game-session/:sessionId/player/:clientId', languageDetectionMiddleware, authToken.playerProtect, quizGameController.getPlayerSessionData);

router.get('/quiz/game-session/:sessionId/players', languageDetectionMiddleware, authToken.playerProtect, quizGameController.getSessionLeaderboard);

// Points Calculation Route
router.post('/quiz/calculate-points', languageDetectionMiddleware, quizGameController.calculateQuestionPoints);

router.post('/quiz/player-response-answer', languageDetectionMiddleware, authToken.commonProtect, quizGameController.playerResponseAnswer);
router.post('/quiz/complete-questions-data', languageDetectionMiddleware, authToken.commonProtect, quizGameController.completeQuizGameSessionQuestionsData);

// Quiz Feedback Routes
router.post('/quiz/game-session/feedback', languageDetectionMiddleware, authToken.playerProtect, validate(playerValidation.submitQuizFeedback), playerController.submitQuizFeedback);

// Player Game Session History Route
router.get('/quiz/game-session/history/:clientId', languageDetectionMiddleware, authToken.commonProtect, quizGameController.getPlayerGameSessionHistory);

// Leaderboard Routes
router.get('/quiz/leaderboard/local', languageDetectionMiddleware, authToken.commonProtect, quizGameController.getLocalLeaderboard);

router.get('/quiz/leaderboard/national', languageDetectionMiddleware, authToken.commonProtect, quizGameController.getNationalLeaderboard);

router.get('/quiz/leaderboard/franchisee/:franchiseeInfoId', languageDetectionMiddleware, authToken.commonProtect, quizGameController.getFranchiseeLeaderboard);

router.post('/quiz/leaderboard/local/bulk-insert', languageDetectionMiddleware, authToken.commonProtect, quizGameController.createBulkLocalLeaderboard);
router.post('/quiz/leaderboard/national/bulk-insert', languageDetectionMiddleware, authToken.commonProtect, quizGameController.createBulkNationalLeaderboard);
router.post('/quiz/leaderboard/franchisee/bulk-insert', languageDetectionMiddleware, authToken.commonProtect, quizGameController.createBulkFranchiseeLeaderboard);

module.exports = router;