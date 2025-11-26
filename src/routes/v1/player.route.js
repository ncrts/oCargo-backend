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

router.post('/auth/signup', playerController.signup);
router.post('/auth/signin', languageDetectionMiddleware, playerController.signin);
router.post('/auth/signout', authToken.playerProtect, playerController.signout);
router.post('/auth/send-verification-email', authToken.playerOptionalProtect, playerController.sendOTPforVerificationEmail);
router.post('/auth/email-otp-verify', authToken.playerOptionalProtect, playerController.verifyEmailOTP);

router.get('/generate-pseudo-name', playerController.generateFiveUniquePseudoNames);
router.get('/profile', authToken.playerProtect, playerController.getPlayerProfile);
router.patch('/profile', authToken.playerProtect, validate(playerValidation.updatePlayerProfile), playerController.updatePlayerProfile);

router
    .route('/profile-picture/:id')
    .patch(authToken.playerProtect, validate(playerValidation.updatePlayerPicture), playerProfilePictureUpload.single('profileAvatar'), playerController.updatePlayerProfilePicture)
    .post(authToken.playerProtect, validate(playerValidation.deletePlayerPicture), playerController.deletePlayerProfilePicture);



module.exports = router;