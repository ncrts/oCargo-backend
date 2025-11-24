const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights'); 

const { userProfileUpload } = require('../../filesuploder/user.files');
const { commonFileUpload } = require('../../filesuploder/common.files');
const commonController = require('../../controllers/apis/common.controller');

const router = express.Router();

router.post('/s3-common-file-uploader', authToken.commonProtect, commonFileUpload.single('file'), commonController.commonS3FileUploadedKeys);
router.post('/send-request-body-data', commonController.sendRequestBodyData);

module.exports = router;