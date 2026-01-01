const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights'); 

const { languageDetectionMiddleware } = require('../../utils/languageConverter');


const { userProfileUpload } = require('../../filesuploder/user.files');
const { commonFileUpload } = require('../../filesuploder/common.files');
const commonController = require('../../controllers/apis/common.controller');

const cmsValidation = require('../../validations/cms.validation');


const router = express.Router();

router.post('/s3-common-file-uploader', authToken.commonProtect, commonFileUpload.single('file'), commonController.commonS3FileUploadedKeys);
router.post('/send-request-body-data', commonController.sendRequestBodyData);
router.post('/avatars/bulk-insert', commonController.insertMultipleAvatars);
router.get('/avatars', commonController.getAllAvatars);
router.post('/foods/bulk-insert', commonController.insertMultipleFoods);
router.get('/foods', languageDetectionMiddleware, commonController.getAllFoods);
router.get('/badges-master', languageDetectionMiddleware, commonController.getAllBadges);

router
    .route('/cms')
    .post(authToken.franchisorProtect, accessRoleRights('manageCms'), validate(cmsValidation.createCms), commonController.createdCms)

router
    .route('/cms/:slug')
    .get(commonController.getCms)

router
    .route('/cms-update/:id')
    .patch(authToken.franchisorProtect, accessRoleRights('manageCms'), validate(cmsValidation.updateCms), commonController.updateCms)


router
    .route('/admin-dashboard')
    .get(authToken.commonProtectForFranchiseeAndFranchisor, commonController.getAdminDashboardData)

module.exports = router;