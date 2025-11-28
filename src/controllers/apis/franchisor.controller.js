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
const XpRule = require('../../models/xpRule.model');
const Badge = require('../../models/badges.model');

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
		const {
			franchisorInfoId,
			firstName,
			lastName,
			email,
			phonenoPrefix,
			phoneno,
			role,
			creatorId,
			password
		} = req.body;

		const normalizedEmail = email ? email.trim().toLowerCase() : null;

		if (normalizedEmail) {
			const emailExists = await FranchisorUser.findOne({ email: normalizedEmail, isDeleted: false });
			if (emailExists) {
				return res.status(httpStatus.CONFLICT).json({
					success: false,
					message: getMessage("FRANCHISOR_EMAIL_ALREADY_EXISTS", res.locals.language),
					data: null
				});
			}
		}

		if (phoneno && phonenoPrefix) {
			const phoneExists = await FranchisorUser.findOne({ phonenoPrefix, phoneno, isDeleted: false });
			if (phoneExists) {
				return res.status(httpStatus.CONFLICT).json({
					success: false,
					message: getMessage("FRANCHISOR_PHONE_ALREADY_EXISTS", res.locals.language),
					data: null
				});
			}
		}

		let resolvedPassword = password;
		if (!resolvedPassword) {
			resolvedPassword = role === 'HqStaff' ? 'hqstaff@123' : 'admin@123';
		}

		let userData = {
			franchisorInfoId,
			firstName,
			lastName,
			email: normalizedEmail,
			phonenoPrefix,
			phoneno,
			role,
			isEmailVerified: true,
			isPhonenoVerified: true,
			password: resolvedPassword
		};
		if (role === 'HqStaff') {
			if (creatorId) {
				userData.creatorId = creatorId;
			}
		} else if (creatorId) {
			userData.creatorId = creatorId;
		}
		const franchisorUser = new FranchisorUser(userData);
		await franchisorUser.save();
		res.status(httpStatus.CREATED).json({
			success: true,
			message: getMessage("FRANCHISOR_USER_CREATED_SUCCESS", res.locals.language),
			data: franchisorUser
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: getMessage("FRANCHISOR_USER_CREATION_FAILED", res.locals.language),
			data: err?.message || null
		});
	}
};

const updateFranchisorUser = async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body || {};
		const franchisorUser = await FranchisorUser.findById(id);
		if (!franchisorUser || franchisorUser.isDeleted) {
			return res.status(httpStatus.OK).json({
				success: false,
				message: getMessage("FRANCHISOR_USER_NOT_FOUND", res.locals.language),
				data: null
			});
		}

		if (updates.email !== undefined && updates.email !== null) {
			const normalizedEmail = updates.email.trim().toLowerCase();
			const emailExists = await FranchisorUser.findOne({
				_id: { $ne: franchisorUser._id },
				email: normalizedEmail,
				isDeleted: false
			});
			if (emailExists) {
				return res.status(httpStatus.CONFLICT).json({
					success: false,
					message: getMessage("FRANCHISOR_EMAIL_ALREADY_EXISTS", res.locals.language),
					data: null
				});
			}
			franchisorUser.email = normalizedEmail;
		}

		const targetPhonePrefix = updates.phonenoPrefix !== undefined ? updates.phonenoPrefix : franchisorUser.phonenoPrefix;
		const targetPhone = updates.phoneno !== undefined ? updates.phoneno : franchisorUser.phoneno;
		if (targetPhonePrefix && targetPhone) {
			const phoneExists = await FranchisorUser.findOne({
				_id: { $ne: franchisorUser._id },
				phonenoPrefix: targetPhonePrefix,
				phoneno: targetPhone,
				isDeleted: false
			});
			if (phoneExists) {
				return res.status(httpStatus.CONFLICT).json({
					success: false,
					message: getMessage("FRANCHISOR_PHONE_ALREADY_EXISTS", res.locals.language),
					data: null
				});
			}
		}

		const updatableFields = [
			'franchisorInfoId',
			'firstName',
			'lastName',
			'phonenoPrefix',
			'phoneno',
			'role',
			'isEmailVerified',
			'isPhonenoVerified',
			'creatorId',
			'isActive'
		];

		updatableFields.forEach(field => {
			if (updates[field] !== undefined) {
				franchisorUser[field] = updates[field];
			}
		});

		if (updates.password) {
			franchisorUser.password = updates.password;
		}

		franchisorUser.updatedAt = Date.now();
		await franchisorUser.save();

		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISOR_USER_UPDATED_SUCCESS", res.locals.language),
			data: franchisorUser
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: err.message,
			data: null
		});
	}
};

const getFranchisorUser = async (req, res) => {
	try {
		const { id } = req.params;
		const franchisorUser = await FranchisorUser.findOne({ _id: id, isDeleted: false });
		if (!franchisorUser) {
			return res.status(httpStatus.OK).json({
				success: false,
				message: getMessage("FRANCHISOR_USER_NOT_FOUND", res.locals.language),
				data: null
			});
		}
		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISOR_USER_FETCH_SUCCESS", res.locals.language),
			data: franchisorUser
		});
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};

const getFranchisorUsersList = async (req, res) => {
	try {
		const { role, isActive, franchisorInfoId } = req.query;
		const filter = { isDeleted: false };
		if (role) filter.role = role;
		if (franchisorInfoId) filter.franchisorInfoId = franchisorInfoId;
		if (isActive !== undefined) {
			filter.isActive = String(isActive).toLowerCase() === 'true';
		}
		const franchisorUsers = await FranchisorUser.find(filter).sort({ createdAt: -1 });
		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISOR_USERS_LIST_FETCH_SUCCESS", res.locals.language),
			data: franchisorUsers,
			count: franchisorUsers.length
		});
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
		const franchisorUser = await FranchisorUser.findByCredentials(email, password);
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

/**
 * Bulk insert XP Rules
 * POST /franchisor/xp-rules/bulk-insert
 * Body: Array of XP rule objects
 */

const bulkInsertXpRules = async (req, res) => {
	try {
		if (!Array.isArray(req.body) || req.body.length === 0) {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'Request body must be a non-empty array', data: null });
		}
		const inserted = await XpRule.insertMany(req.body, { ordered: false });
		res.status(httpStatus.CREATED).json({ success: true, message: 'XP rules inserted', data: inserted });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};

/**
 * Bulk insert Badges
 * POST /franchisor/badges/bulk-insert
 * Body: Array of badge objects
 */

const bulkInsertBadges = async (req, res) => {
	try {
		if (!Array.isArray(req.body) || req.body.length === 0) {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'Request body must be a non-empty array', data: null });
		}
		const inserted = await Badge.insertMany(req.body, { ordered: false });
		res.status(httpStatus.CREATED).json({ success: true, message: 'Badges inserted', data: inserted });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};

module.exports = {
    createFranchisorInfo,
    updateFranchisorInfo,
    getFranchisorInfo,
    createFranchisorUser,
	updateFranchisorUser,
	getFranchisorUser,
	getFranchisorUsersList,
    signinFranchisorUser,
    signoutFranchisorUser,
    createFranchiseeInfo,
    createFranchiseeUser,
    bulkInsertXpRules,
	bulkInsertBadges
};