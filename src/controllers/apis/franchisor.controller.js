// Core dependencies and utilities
const path = require('path');
const base64 = require('base-64');
const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const randomstring = require('randomstring');
const MailHelper = require('../../utils/mailHelper');


// Mongoose models
const FranchisorUser = require('../../models/franchisor.user.model');
const FranchisorInfo = require('../../models/franchisorInfo.model');
const FranchiseeInfo = require('../../models/franchiseeInfo.model');
const FranchiseeUser = require('../../models/franchisee.user.model');


const { getMessage } = require("../../../config/languageLocalization");


/**
 * Create a new franchisor info record
 * POST /franchisor/info
 */
const createFranchisorInfo = catchAsync(async (req, res) => {
	try {
		const franchisorInfo = new FranchisorInfo(req.body);
		await franchisorInfo.save();
		res.status(httpStatus.CREATED).json({ success: true, message: 'Franchisor info created', data: franchisorInfo });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
});

/**
 * Update an existing franchisor info record
 * PATCH /franchisor/info/:id
 */
const updateFranchisorInfo = catchAsync(async (req, res) => {
	try {
		const franchisorInfo = await FranchisorInfo.findByIdAndUpdate(
			req.params.id,
			{ $set: req.body },
			{ new: true }
		);
		if (!franchisorInfo) {
			return res.status(httpStatus.OK).json({ success: false, message: 'Franchisor info not found', data: null });
		}
		res.status(httpStatus.OK).json({ success: true, message: 'Franchisor info updated', data: franchisorInfo });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
});

/**
 * Get franchisor info by ID
 * GET /franchisor/info/:id
 */
const getFranchisorInfo = catchAsync(async (req, res) => {
	try {
		const franchisorInfo = await FranchisorInfo.findById(req.params.id);
		if (!franchisorInfo) {
			return res.status(httpStatus.OK).json({ success: false, message: 'Franchisor info not found', data: null });
		}
		res.status(httpStatus.OK).json({ success: true, message: 'Franchisor info fetched', data: franchisorInfo });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
});


/**
 * Create a FranchisorUser (admin or HQ staff)
 * POST /franchisor/user
 * Required fields: franchisorInfoId, firstName, lastName, email, phonenoPrefix, phoneno, role
 * Sets isEmailVerified and isPhonenoVerified to true by default
 * Password: 'admin@123' for role 'admin', 'hqstaff@123' for role 'HqStaff'
 */
const createFranchisorUser = async (req, res) => {
	try {
		const { franchisorInfoId, firstName, lastName, email, phonenoPrefix, phoneno, role, creatorId } = req.body;
		let password = 'admin@123';
		let userData = {
			franchisorInfoId,
			firstName,
			lastName,
			email,
			phonenoPrefix,
			phoneno,
			role,
			isEmailVerified: true,
			isPhonenoVerified: true,
			password
		};
		if (role === 'HqStaff') {
			userData.password = 'hqstaff@123';
			if (creatorId) {
				userData.creatorId = creatorId;
			}
		}
		const franchisorUser = new FranchisorUser(userData);
		await franchisorUser.save();
		res.status(httpStatus.CREATED).json({ success: true, message: 'Franchisor user created', data: franchisorUser });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};

/**
 * FranchisorUser Signin
 * POST /franchisor/auth/signin
 * Required fields: email, password, role
 * Returns JWT token and user data if successful
 */
const signinFranchisorUser = async (req, res) => {
	try {
		const { email, password, role } = req.body;
		const franchisorUser = await FranchisorUser.findByCredentials(email, password, role);
		if (!franchisorUser.isEmailVerified) {
			return res.status(httpStatus.OK).json({ success: false, message: getMessage("EMAIL_NOT_VERIFIED", res.locals.language), data: null });
		}
		const token = await franchisorUser.generateAuthToken();
		res.status(httpStatus.OK).json({ success: true, message: getMessage("FRANCHISOR_SIGNIN_SUCCESS", res.locals.language), data: { franchisorUser, token } });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: getMessage(err.message, res.locals.language), data: null });
	}
};

/**
 * Handles the signout process for a franchisor user.
 * Clears the user's token and ends the session.
 * @async
 * @function signoutFranchisorUser
 */
const signoutFranchisorUser = async (req, res) => {
	try {
		req.franchisorUser.token = '';
		await req.franchisorUser.save();
		res.status(httpStatus.OK).json({ success: true, message: getMessage("FRANCHISOR_SIGNOUT_SUCCESS", res.locals.language), data: null });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: getMessage(err.message, res.locals.language), data: null });
	}
};

/**
 * Create a FranchiseeInfo record
 * POST /franchisor/franchisee
 * Required fields: name, phonePrefix, phone, email, address (object), location (object)
 * Sets franchisorInfoId to default value, and marks email/phone as verified (custom fields)
 */
const createFranchiseeInfo = async (req, res) => {
	try {
		const {
			name,
			phonePrefix,
			phone,
			email,
			address,
			location
		} = req.body;
		// Default franchisorInfoId as requested
		const franchisorInfoId = '691868714fb84e48f683a761';
		// Add custom fields for verification if needed (not in schema, but can be added to response)
		const franchiseeInfo = new FranchiseeInfo({
			franchisorInfoId,
			name,
			phonePrefix,
			phone,
			email,
			address,
			location,
			isEmailVerified: true,
			isPhoneVerified: true
		});
		await franchiseeInfo.save();
		res.status(httpStatus.CREATED).json({ success: true, message: getMessage("FRANCHISEE_INFO_CREATED", res.locals.language), data: franchiseeInfo });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: getMessage(err.message, res.locals.language), data: null });
	}
};


/**
 * Create a FranchiseeUser (manager or staff)
 * POST /franchisor/franchisee-user
 * Required fields: franchiseeInfoId, firstName, lastName, email, phonenoPrefix, phoneno, role
 * Sets isEmailVerified and isPhonenoVerified to true by default
 * Password: 'manager@123' for role 'manager', 'staff@123' for role 'staff' if not provided
 * creatorObj: { creatorId, creatorRole } (can be FranchisorUser or FranchiseeUser)
 */
const createFranchiseeUser = async (req, res) => {
	try {
		const {
			franchiseeInfoId,
			firstName,
			lastName,
			email,
			phonenoPrefix,
			phoneno,
			password,
			role,
			creatorObj
		} = req.body;
		let userPassword = password;
		if (!userPassword) {
			if (role === 'manager') userPassword = 'manager@123';
			else if (role === 'staff') userPassword = 'staff@123';
		}
		const userData = {
			franchiseeInfoId,
			firstName,
			lastName,
			email,
			phonenoPrefix,
			phoneno,
			password: userPassword,
			role,
			isEmailVerified: true,
			isPhonenoVerified: true
		};
		if (creatorObj && creatorObj.creatorId && creatorObj.creatorRole) {
			userData.creatorObj = {
				creatorId: creatorObj.creatorId,
				creatorRole: creatorObj.creatorRole
			};
		}
		const franchiseeUser = new FranchiseeUser(userData);
		await franchiseeUser.save();
		res.status(httpStatus.CREATED).json({ success: true, message: getMessage("FRANCHISEE_USER_CREATED", res.locals.language), data: franchiseeUser });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: getMessage(err.message, res.locals.language), data: null });
	}
};

module.exports = {
    createFranchisorInfo,
    updateFranchisorInfo,
    getFranchisorInfo,
    createFranchisorUser,
    signinFranchisorUser,
    signoutFranchisorUser,
    createFranchiseeInfo,
    createFranchiseeUser
};