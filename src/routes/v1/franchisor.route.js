const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights');
const { languageDetectionMiddleware } = require('../../utils/languageConverter');



const franchisorController = require('../../controllers/apis/franchisor.controller');

const router = express.Router();


// Create franchisor info
router
    .post('/info', franchisorController.createFranchisorInfo)
    .patch('/info/:id', franchisorController.updateFranchisorInfo)
    .get('/info/:id', franchisorController.getFranchisorInfo)

// Franchisor User Auth
router
    .post('/auth/signin', languageDetectionMiddleware, franchisorController.signinFranchisorUser)
    .post('/auth/signout', authToken.franchisorProtect, languageDetectionMiddleware, franchisorController.signoutFranchisorUser);

// Franchisor User Management
router
    .post('/user', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('createFranchisorUser'), franchisorController.createFranchisorUser)
    .patch('/user/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('updateFranchisorUser'), franchisorController.updateFranchisorUser)
    .get('/user/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchisorUser'), franchisorController.getFranchisorUser)
    .get('/users', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchisorUsersList'), franchisorController.getFranchisorUsersList);

// Franchisee Info Management
router.post('/franchisee-info', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('createFranchiseeInfo'), franchisorController.createFranchiseeInfo);
router.patch('/franchisee-info/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('updateFranchiseeInfo'), franchisorController.updateFranchiseeInfo);
router.get('/franchisee-info', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchiseeInfoList'), franchisorController.getFranchiseeInfoList);

// Franchisee User Management
router.post('/franchisee-user', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('createFranchiseeUser'), franchisorController.createFranchiseeUser);
router.patch('/franchisee-user/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('updateFranchiseeUser'), franchisorController.updateFranchiseeUser);
router.get('/franchisee-user/:id', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchiseeUser'), franchisorController.getFranchiseeUser);
router.get('/franchisee-users', authToken.franchisorProtect, languageDetectionMiddleware, accessRoleRights('getFranchiseeUsersList'), franchisorController.getFranchiseeUsersList);

// Bulk Insert XP Rules
router.post('/xp-rules/bulk-insert', authToken.franchisorProtect, accessRoleRights('bulkInsertXpRules'), franchisorController.bulkInsertXpRules);

// Bulk Insert Badges
router.post('/badges/bulk-insert', authToken.franchisorProtect, accessRoleRights('bulkInsertBadges'), franchisorController.bulkInsertBadges);

// Export the router
module.exports = router;