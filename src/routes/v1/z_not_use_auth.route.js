const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth')
const authValidation = require('../../validations/auth.validation');
const authController = require('../../controllers/auth.controller');

const router = express.Router();

// const userProfileStorage = multer.diskStorage({
//     destination:uploadPath+'/profile-images',
//     filename:function(req,file,cb){
//         cb(null,file.fieldname+'-'+Date.now()+path.extname(file.originalname))
//     }
// })
// const userProfileUpload = multer({
//     storage:userProfileStorage,
//     fileFilter(req, file, cb) {
//         if (!file.originalname.match(/\.(png|jpg|jpeg)$/)) {
//             return cb(new Error('Please upload an image file'))
//         }
//         cb(undefined, true)
//     }
// })

router.post('/register', validate(authValidation.register), authController.register);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/logout', authToken.protect, authController.logout);
router.post('/social-login', authController.socialLogin);
router.post('/send-verification-email', authToken.optionalProtect, validate(authValidation.sendVerificationOtp), authController.sendVerificationEmail);
router.post('/resend-verification-email', authToken.optionalProtect, validate(authValidation.sendVerificationOtp), authController.resendVerificationEmail);
router.post('/verify-otp', authToken.optionalProtect, validate(authValidation.verifyOtp), authController.verifyOTP);
router.post('/reset-password', authToken.protect, validate(authValidation.resetPassword), authController.resetPassword);
router.post('/forgot-password', authController.forgotPassword);
router.post('/forgot-password-link', validate(authValidation.forgotPassword), authController.createForgotPasswordLink);

module.exports = router;