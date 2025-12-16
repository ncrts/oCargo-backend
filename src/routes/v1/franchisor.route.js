const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights');
const { languageDetectionMiddleware } = require('../../utils/languageConverter');



const franchisorController = require('../../controllers/apis/franchisor.controller');
const franchiseeController = require('../../controllers/apis/franchisee.controller');

const router = express.Router();


// Create franchisor info
router
    .post('/info', franchisorController.createFranchisorInfo)
    .patch('/info/:id', franchisorController.updateFranchisorInfo)
    .get('/info', franchisorController.getFranchisorInfo)

// Franchisor User Auth
router
    .post('/auth/signin', languageDetectionMiddleware, franchisorController.signinFranchisorUser)
    .post('/auth/signout', authToken.franchisorProtect, languageDetectionMiddleware, franchisorController.signoutFranchisorUser);

// Franchisor User Management
router
    .post('/user', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('createFranchisorUser'), franchisorController.createFranchisorUser)
    .patch('/user/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('updateFranchisorUser'), franchisorController.updateFranchisorUser)
    .get('/user/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchisorUser'), franchisorController.getFranchisorUser)
    .delete('/user/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('deleteFranchisorUser'), franchisorController.deleteFranchisorUser)
    .get('/users', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchisorUsersList'), franchisorController.getFranchisorUsersList);

// Franchisee Info Management
router.post('/franchisee-info', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('createFranchiseeInfo'), franchisorController.createFranchiseeInfo);
router.patch('/franchisee-info/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('updateFranchiseeInfo'), franchisorController.updateFranchiseeInfo);
router.get('/franchisee-info', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchiseeInfoList'), franchisorController.getFranchiseeInfoList);

// Franchisee User Management
router.post('/franchisee-user', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, accessRoleRights('createFranchiseeUser'), franchisorController.createFranchiseeUser);
router.patch('/franchisee-user/:id', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, accessRoleRights('updateFranchiseeUser'), franchisorController.updateFranchiseeUser);
router.get('/franchisee-user/:id', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, accessRoleRights('getFranchiseeUser'), franchisorController.getFranchiseeUser);
router.delete('/franchisee-user/:id', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, accessRoleRights('deleteFranchiseeUser'), franchisorController.deleteFranchiseeUser);
router.get('/franchisee-users', authToken.commonProtectForFranchiseeAndFranchisor, languageDetectionMiddleware, accessRoleRights('getFranchiseeUsersList'), franchisorController.getFranchiseeUsersList);

// Create Restaurant (requires franchisee authentication)
router.post('/restaurant', authToken.commonProtectForFranchiseeAndFranchisor, franchiseeController.createRestaurant);

// Update Restaurant (requires franchisee authentication)
router.patch('/restaurant/:id', authToken.commonProtectForFranchiseeAndFranchisor, franchiseeController.updateRestaurant);

// Get Restaurant List or Single Restaurant (requires common authentication)
router.get('/restaurant/list', authToken.commonProtectForFranchiseeAndFranchisor, franchiseeController.getRestaurantList);

// Delete Restaurant (soft delete, requires franchisee authentication)
router.patch('/restaurant/delete/:id', authToken.commonProtectForFranchiseeAndFranchisor, franchiseeController.deleteRestaurant);

// Bulk Insert XP Rules
router.post('/xp-rules/bulk-insert', authToken.franchisorProtect, accessRoleRights('bulkInsertXpRules'), franchisorController.bulkInsertXpRules);

// Bulk Insert Badges
router.post('/badges/bulk-insert', authToken.franchisorProtect, accessRoleRights('bulkInsertBadges'), franchisorController.bulkInsertBadges);

router.post('/badge-masters/bulk-insert', authToken.franchisorProtect, accessRoleRights('bulkInsertBadgeMasters'), franchisorController.bulkInsertBadgeMasters);
// Export the router
module.exports = router;