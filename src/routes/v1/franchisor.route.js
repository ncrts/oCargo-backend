const express = require('express')
const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights');


const franchisorController = require('../../controllers/apis/franchisor.controller');

const router = express.Router();


// Create franchisor info
router
    .post('/info', franchisorController.createFranchisorInfo)
    .patch('/info/:id', franchisorController.updateFranchisorInfo)
    .get('/info/:id', franchisorController.getFranchisorInfo)

// Franchisor User Management
router
    .post('/user', franchisorController.createFranchisorUser)

// Franchisor User Auth
router
    .post('/auth/signin', franchisorController.signinFranchisorUser)
    .post('/auth/signout', authToken.franchisorProtect, franchisorController.signoutFranchisorUser); // Add franchisor user signout route

// Franchisee Info Management
router.post('/franchisee-info', authToken.franchisorProtect, accessRoleRights('createFranchisorInfo'), franchisorController.createFranchiseeInfo);

// Franchisee User Management
router.post('/franchisee-user', authToken.franchisorProtect, accessRoleRights('createFranchiseeUser'), franchisorController.createFranchiseeUser);


// Bulk Insert XP Rules
router.post('/xp-rules/bulk-insert', authToken.franchisorProtect, accessRoleRights('bulkInsertXpRules'), franchisorController.bulkInsertXpRules);

// Bulk Insert Badges
router.post('/badges/bulk-insert', authToken.franchisorProtect, accessRoleRights('bulkInsertBadges'), franchisorController.bulkInsertBadges);

// Export the router
module.exports = router;