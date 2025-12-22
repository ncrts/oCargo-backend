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

router.post('/info/find-nearest', authToken.commonProtect, languageDetectionMiddleware, franchiseeController.findNearestFranchisees);

// Create Restaurant (requires franchisee authentication)
router.post('/restaurant', authToken.commonProtectForFranchiseeAndFranchisor, franchiseeController.createRestaurant);

// Update Restaurant (requires franchisee authentication)
router.patch('/restaurant/:id', authToken.commonProtectForFranchiseeAndFranchisor, franchiseeController.updateRestaurant);

// Get Restaurant List or Single Restaurant (requires common authentication)
router.get('/restaurant/list', authToken.commonProtect, franchiseeController.getRestaurantList);

// Delete Restaurant (soft delete, requires franchisee authentication)
router.patch('/restaurant/delete/:id', authToken.commonProtectForFranchiseeAndFranchisor, franchiseeController.deleteRestaurant);



module.exports = router;

