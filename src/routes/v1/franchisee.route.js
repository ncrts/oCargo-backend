const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights'); 

const { userProfileUpload } = require('../../filesuploder/user.files');
const commonController = require('../../controllers/apis/common.controller');
const franchiseeController = require('../../controllers/apis/franchisee.controller');
const { languageDetectionMiddleware } = require('../../utils/languageConverter');



const router = express.Router();

// Franchisee User Signin
router.post('/auth/signin', languageDetectionMiddleware, franchiseeController.signinFranchiseeUser);

// Franchisee User Signout
router.post('/auth/signout', authToken.franchiseeProtect, languageDetectionMiddleware, franchiseeController.signoutFranchiseeUser);

// Get franchisee list or single franchisee data
router.get('/info/list', authToken.commonProtect, languageDetectionMiddleware, franchiseeController.getFranchiseeData);

module.exports = router;