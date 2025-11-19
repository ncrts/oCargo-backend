const express = require('express')
const path = require('path');

const validate = require('../../middleware/validate');
const authToken = require('../../middleware/auth');
const accessRoleRights = require('../../middleware/accessRoleRights');

const userValidation = require('../../validations/user.validation');
const userController = require('../../controllers/user.controller');

const router = express.Router();

router.route('/')
    .post(authToken.protect, accessRoleRights("createUser"), validate(userValidation.createUser), userController.createUser)

router.route('/:userId')
    .get(authToken.optionalProtect, validate(userValidation.getUser), userController.getUser)
    .patch(authToken.optionalProtect, validate(userValidation.updateUser), userController.updateUser)
    .delete(authToken.protect, accessRoleRights("manageUser"), validate(userValidation.deleteUser), userController.deleteUser)


module.exports = router;