const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')
const { playerProfilePictureUpload } = require('../../filesuploder/player.files');


const validate = require('../../middleware/validate');
const authValidation = require('../../validations/auth.validation');
const playerValidation = require('../../validations/player.validation');

const accessRoleRights = require('../../middleware/accessRoleRights');

const authToken = require('../../middleware/auth');
const playerController = require('../../controllers/apis/player.controller');
const { languageDetectionMiddleware } = require('../../utils/languageConverter');
const router = express.Router();

router.post('/auth/signup', languageDetectionMiddleware, playerController.signup);
router.post('/auth/signin', languageDetectionMiddleware, playerController.signin);
router.post('/auth/social-login', languageDetectionMiddleware, playerController.socialLogin);
router.post('/auth/signout', languageDetectionMiddleware, authToken.playerProtect, playerController.signout);
router.post('/auth/send-verification-email', languageDetectionMiddleware, authToken.playerOptionalProtect, playerController.sendOTPforVerificationEmail);
router.post('/auth/email-otp-verify', languageDetectionMiddleware, authToken.playerOptionalProtect, playerController.verifyEmailOTP);

router.get('/generate-pseudo-name', languageDetectionMiddleware, playerController.generateFiveUniquePseudoNames);
router.get('/profile', languageDetectionMiddleware, authToken.playerProtect, playerController.getPlayerProfile);
router.patch('/profile', languageDetectionMiddleware, authToken.playerProtect, playerController.updatePlayerProfile);

router
    .route('/profile-picture/:id')
    .patch(languageDetectionMiddleware, authToken.playerProtect, validate(playerValidation.updatePlayerPicture), playerProfilePictureUpload.single('profileAvatar'), playerController.updatePlayerProfilePicture)
    .post(languageDetectionMiddleware, authToken.playerProtect, validate(playerValidation.deletePlayerPicture), playerController.deletePlayerProfilePicture);

router.post('/firebase/custom-token', languageDetectionMiddleware, authToken.playerProtect, playerController.createFirebaseCustomToken);
router.post('/firebase/signout', languageDetectionMiddleware, authToken.playerProtect, playerController.singoutFirebaseCustomToken);

router.post('/phone/add-or-update', languageDetectionMiddleware, authToken.playerProtect, playerController.addOrUpdatePlayerPhoneNumber);
router.post('/phone/verify', languageDetectionMiddleware, authToken.playerProtect, playerController.verifyPlayerPhoneNumber);

module.exports = router;