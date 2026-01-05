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
const Quiz = require('../../models/quiz.model');
const XpRule = require('../../models/xpRule.model');
const Badge = require('../../models/badges.model');
const BadgeMaster = require('../../models/badge.master.model');

const { getMessage } = require("../../../config/languageLocalization");
const validator = require('validator');


// const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';

const s3BaseUrl = process.env.S3_CDN ? `https://${process.env.S3_CDN}/` : '';

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
		let franchisorInfoId = req.query.id || "691868714fb84e48f683a761"
		const franchisorInfo = await FranchisorInfo.findById(franchisorInfoId);
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
		const { role, isActive, franchisorInfoId, searchKey, limit = 20, skip = 0 } = req.query;
		const filter = { isDeleted: false };
		if (role) filter.role = role;
		if (franchisorInfoId) filter.franchisorInfoId = franchisorInfoId;
		if (isActive !== undefined) {
			filter.isActive = String(isActive).toLowerCase() === 'true';
		}

		// Add searchKey filter for firstName, lastName, and email using regex (case-insensitive)
		if (searchKey) {
			filter.$or = [
				{ firstName: { $regex: searchKey, $options: 'i' } },
				{ lastName: { $regex: searchKey, $options: 'i' } },
				{ email: { $regex: searchKey, $options: 'i' } }
			];
		}

		// Parse limit and skip as integers
		const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // Max 100, default 20
		const pageSkip = Math.max(0, parseInt(skip) || 0);

		// Get total count for pagination info
		const totalCount = await FranchisorUser.countDocuments(filter);

		const franchisorUsers = await FranchisorUser.find(filter)
			.sort({ createdAt: -1 })
			.limit(pageLimit)
			.skip(pageSkip);

		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISOR_USERS_LIST_FETCH_SUCCESS", res.locals.language),
			data: franchisorUsers,
			count: franchisorUsers.length,
			totalCount: totalCount,
			pagination: {
				limit: pageLimit,
				skip: pageSkip,
				page: Math.floor(pageSkip / pageLimit) + 1,
				totalPages: Math.ceil(totalCount / pageLimit)
			}
		});
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};

/**
 * Delete a FranchisorUser (soft delete)
 * DELETE /franchisor/user/:id
 * Marks user as deleted without removing from database
 */
const deleteFranchisorUser = async (req, res) => {
	try {
		const { id } = req.params;
		const franchisorUser = await FranchisorUser.findById(id);
		if (!franchisorUser || franchisorUser.isDeleted) {
			return res.status(httpStatus.NOT_FOUND).json({
				success: false,
				message: getMessage("FRANCHISOR_USER_NOT_FOUND", res.locals.language),
				data: null
			});
		}

		franchisorUser.isDeleted = true;
		franchisorUser.updatedAt = Date.now();
		await franchisorUser.save();

		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISOR_USER_DELETED_SUCCESS", res.locals.language),
			data: null
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: err.message,
			data: null
		});
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
			icon,
			googleReviewLink,
			address,
			location
		} = req.body;

		// Validate required fields
		if (!name || typeof name !== 'string' || !name.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID_NAME", res.locals.language), data: null });
		}
		if (!phonePrefix || typeof phonePrefix !== 'string' || !phonePrefix.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID_PHONE_PREFIX", res.locals.language), data: null });
		}
		if (!phone || typeof phone !== 'string' || !phone.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID_PHONE", res.locals.language), data: null });
		}

		// Validate uniqueness of phone across franchisees
		const existingPhone = await FranchiseeInfo.findOne({ phonePrefix: phonePrefix, phone: phone, isDeleted: false });
		if (existingPhone) {
			return res.status(httpStatus.CONFLICT).json({ success: false, message: getMessage("FRANCHISEE_PHONE_ALREADY_EXISTS", res.locals.language), data: null });
		}

		// Validate email (if provided) and uniqueness
		let normalizedEmail = null;
		if (email !== undefined && email !== null && email !== '') {
			if (!validator.isEmail(email)) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'Invalid email format' });
			}
			normalizedEmail = email.trim().toLowerCase();
			const existingEmail = await FranchiseeInfo.findOne({ email: normalizedEmail, isDeleted: false });
			if (existingEmail) {
				return res.status(httpStatus.CONFLICT).json({ success: false, message: getMessage("FRANCHISEE_EMAIL_ALREADY_EXISTS", res.locals.language), data: null });
			}
		}

		// Validate address and location presence and structure
		if (!address || typeof address !== 'object') {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'address is required and must be an object' });
		}
		// Minimal address validation: require line1 and city
		if (!address.line1 || typeof address.line1 !== 'string' || !address.line1.trim() || !address.city || typeof address.city !== 'string' || !address.city.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'address must include at least line1 and city' });
		}
		if (!location || typeof location !== 'object') {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'location is required and must be an object' });
		}
		if (!location.coordinates || typeof location.coordinates !== 'object') {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'location.coordinates is required' });
		}
		const { latitude, longitude } = location.coordinates;
		if (typeof latitude !== 'number' || typeof longitude !== 'number') {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'location.coordinates.latitude and longitude must be numbers' });
		}

		// icon is optional but if provided must be a string
		if (icon !== undefined && icon !== null && icon !== '') {
			if (typeof icon !== 'string') {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'icon must be a string URL' });
			}
		}

		// googleReviewLink is optional but if provided must be a valid URL string
		if (googleReviewLink !== undefined && googleReviewLink !== null && googleReviewLink !== '') {
			if (typeof googleReviewLink !== 'string' || !validator.isURL(googleReviewLink, { require_protocol: true })) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'googleReviewLink must be a valid URL' });
			}
		}

		// Find active franchisor (first one found) and set its id
		const franchisor = await FranchisorInfo.findOne({ isDeleted: false, isActive: true });
		if (!franchisor) {
			return res.status(httpStatus.NOT_FOUND).json({ success: false, message: getMessage("FRANCHISOR_NOT_FOUND", res.locals.language), data: null });
		}
		const franchisorInfoId = franchisor._id;
		// Add custom fields for verification if needed (not in schema, but can be added to response)
		const franchiseeInfo = new FranchiseeInfo({
			franchisorInfoId,
			name: name.trim(),
			phonePrefix: phonePrefix.trim(),
			phone: phone.trim(),
			email: normalizedEmail,
			icon: icon ? icon.trim() : null,
			googleReviewLink: googleReviewLink ? googleReviewLink.trim() : null,
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
 * Update an existing franchisee info record
 * PATCH /franchisor/franchisee/:id
 * Allows updating name, phone, email, address, location, icon with same validations as create
 */
const updateFranchiseeInfo = async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body || {};

		const franchiseeInfo = await FranchiseeInfo.findOne({ _id: id, isDeleted: false });
		if (!franchiseeInfo) {
			return res.status(httpStatus.NOT_FOUND).json({ success: false, message: getMessage("FRANCHISEE_INFO_NOT_FOUND", res.locals.language), data: null });
		}

		// Validate and update name if provided
		if (updates.name !== undefined && updates.name !== null) {
			if (typeof updates.name !== 'string' || !updates.name.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'name must be a non-empty string' });
			}
			franchiseeInfo.name = updates.name.trim();
		}

		// Validate and update phone if provided
		if ((updates.phone !== undefined && updates.phone !== null) || (updates.phonePrefix !== undefined && updates.phonePrefix !== null)) {
			const newPhonePrefix = updates.phonePrefix !== undefined ? updates.phonePrefix : franchiseeInfo.phonePrefix;
			const newPhone = updates.phone !== undefined ? updates.phone : franchiseeInfo.phone;

			if (typeof newPhonePrefix !== 'string' || !newPhonePrefix.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'phonePrefix must be a non-empty string' });
			}
			if (typeof newPhone !== 'string' || !newPhone.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'phone must be a non-empty string' });
			}

			// Check uniqueness only if changing phone
			if (newPhone !== franchiseeInfo.phone || newPhonePrefix !== franchiseeInfo.phonePrefix) {
				const existingPhone = await FranchiseeInfo.findOne({ phonePrefix: newPhonePrefix, phone: newPhone, _id: { $ne: id }, isDeleted: false });
				if (existingPhone) {
					return res.status(httpStatus.CONFLICT).json({ success: false, message: getMessage("FRANCHISEE_PHONE_ALREADY_EXISTS", res.locals.language), data: null });
				}
			}

			franchiseeInfo.phonePrefix = newPhonePrefix.trim();
			franchiseeInfo.phone = newPhone.trim();
		}

		// Validate and update email if provided
		if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
			if (!validator.isEmail(updates.email)) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'Invalid email format' });
			}

			const normalizedEmail = updates.email.trim().toLowerCase();
			if (normalizedEmail !== franchiseeInfo.email) {
				const existingEmail = await FranchiseeInfo.findOne({ email: normalizedEmail, _id: { $ne: id }, isDeleted: false });
				if (existingEmail) {
					return res.status(httpStatus.CONFLICT).json({ success: false, message: getMessage("FRANCHISEE_EMAIL_ALREADY_EXISTS", res.locals.language), data: null });
				}
			}

			franchiseeInfo.email = normalizedEmail;
		}

		// Validate and update address if provided
		if (updates.address !== undefined && updates.address !== null) {
			if (typeof updates.address !== 'object') {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'address must be an object' });
			}
			if (!updates.address.line1 || typeof updates.address.line1 !== 'string' || !updates.address.line1.trim() || !updates.address.city || typeof updates.address.city !== 'string' || !updates.address.city.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'address must include at least line1 and city' });
			}
			franchiseeInfo.address = updates.address;
		}

		// Validate and update location if provided
		if (updates.location !== undefined && updates.location !== null) {
			if (typeof updates.location !== 'object') {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'location must be an object' });
			}
			if (!updates.location.coordinates || typeof updates.location.coordinates !== 'object') {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'location.coordinates is required' });
			}
			const { latitude, longitude } = updates.location.coordinates;
			if (typeof latitude !== 'number' || typeof longitude !== 'number') {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'location.coordinates.latitude and longitude must be numbers' });
			}
			franchiseeInfo.location = updates.location;
		}

		// Validate and update icon if provided (optional)
		if (updates.icon !== undefined && updates.icon !== null && updates.icon !== '') {
			if (typeof updates.icon !== 'string') {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'icon must be a string URL' });
			}
			franchiseeInfo.icon = updates.icon.trim();
		}

		// Validate and update googleReviewLink if provided (optional)
		if (updates.googleReviewLink !== undefined && updates.googleReviewLink !== null && updates.googleReviewLink !== '') {
			if (typeof updates.googleReviewLink !== 'string' || !validator.isURL(updates.googleReviewLink, { require_protocol: true })) {
				return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language), data: 'googleReviewLink must be a valid URL' });
			}
			franchiseeInfo.googleReviewLink = updates.googleReviewLink.trim();
		}

		franchiseeInfo.updatedAt = Date.now();
		await franchiseeInfo.save();

		res.status(httpStatus.OK).json({ success: true, message: getMessage("FRANCHISEE_INFO_UPDATED_SUCCESS", res.locals.language), data: franchiseeInfo });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};

/**
 * Get franchisee info list with optional name filter
 * GET /franchisor/franchisees
 * Query parameters: name (optional, regex filter), isActive (optional)
 */
const getFranchiseeInfoList = async (req, res) => {
	try {
		const { name, isActive, limit = 20, skip = 0 } = req.query;

		const filter = { isDeleted: false };

		// If franchiseeUser is authenticated, filter by their franchiseeInfoId
		if (req.franchiseeUser && req.franchiseeUser.franchiseeInfoId) {
			filter._id = req.franchiseeUser.franchiseeInfoId;
		}

		if (name) {
			filter.name = { $regex: name, $options: 'i' }; // Case-insensitive regex match
		}
		if (isActive !== undefined) {
			filter.isActive = String(isActive).toLowerCase() === 'true';
		}

		// Parse limit and skip as integers
		const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // Max 100, default 20
		const pageSkip = Math.max(0, parseInt(skip) || 0);

		// Get total count for pagination info
		const totalCount = await FranchiseeInfo.countDocuments(filter);

		const franchiseeInfos = await FranchiseeInfo.find(filter)
			.sort({ createdAt: -1 })
			.limit(pageLimit)
			.skip(pageSkip);

		// Aggregate counts for franchisee users and quizzes for each franchisee
		const franchiseeInfosWithCounts = await Promise.all(
			franchiseeInfos.map(async (franchiseeInfo) => {
				const franchiseeObj = franchiseeInfo.toObject();

				// Count franchisee users for this franchisee
				const userCount = await FranchiseeUser.countDocuments({
					franchiseeInfoId: franchiseeInfo._id,
					isDeleted: false
				});

				// Count quizzes for this franchisee
				const quizCount = await Quiz.countDocuments({
					franchiseeInfoId: franchiseeInfo._id
				});

				return {
					...franchiseeObj,
					franchiseeUserCount: userCount,
					quizCount: quizCount
				};
			})
		);

		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISEE_INFO_LIST_FETCH_SUCCESS", res.locals.language),
			data: franchiseeInfosWithCounts,
			s3BaseUrl,
			count: franchiseeInfosWithCounts.length,
			totalCount: totalCount,
			pagination: {
				limit: pageLimit,
				skip: pageSkip,
				page: Math.floor(pageSkip / pageLimit) + 1,
				totalPages: Math.ceil(totalCount / pageLimit)
			}
		});
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
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

		// ===== VALIDATION SECTION =====

		// Validate franchiseeInfoId
		if (!franchiseeInfoId || typeof franchiseeInfoId !== 'string' || !franchiseeInfoId.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_VALID_FRANCHISEEINFO_ID", res.locals.language),
				data: null
			});
		}

		// Check if franchisee exists and is not deleted
		const franchisee = await FranchiseeInfo.findOne({ _id: franchiseeInfoId, isDeleted: false });
		if (!franchisee) {
			return res.status(httpStatus.NOT_FOUND).json({
				success: false,
				message: getMessage("FRANCHISEE_INFO_NOT_FOUND", res.locals.language),
				data: null
			});
		}

		// Validate firstName
		if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_FIRSTNAME", res.locals.language),
				data: null
			});
		}

		// Validate lastName
		if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_LASTNAME", res.locals.language),
				data: null
			});
		}

		// Validate email format
		if (!email || typeof email !== 'string' || !email.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_EMAIL_REQUIRED", res.locals.language),
				data: null
			});
		}

		if (!validator.isEmail(email)) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_EMAIL_FORMAT", res.locals.language),
				data: null
			});
		}

		// Normalize email (lowercase and trim)
		const normalizedEmail = email.trim().toLowerCase();

		// Check email uniqueness across FranchiseeUsers
		const existingEmail = await FranchiseeUser.findOne({ email: normalizedEmail, isDeleted: false });
		if (existingEmail) {
			return res.status(httpStatus.CONFLICT).json({
				success: false,
				message: getMessage("FRANCHISEE_EMAIL_ALREADY_EXISTS", res.locals.language),
				data: null
			});
		}

		// Validate phonenoPrefix
		if (!phonenoPrefix || typeof phonenoPrefix !== 'string' || !phonenoPrefix.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_PHONENOPREFIX", res.locals.language),
				data: null
			});
		}

		// Validate phoneno
		if (!phoneno || typeof phoneno !== 'string' || !phoneno.trim()) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_PHONENO", res.locals.language),
				data: null
			});
		}

		// Check phone uniqueness across FranchiseeUsers
		const existingPhone = await FranchiseeUser.findOne({
			phonenoPrefix: phonenoPrefix.trim(),
			phoneno: phoneno.trim(),
			isDeleted: false
		});
		if (existingPhone) {
			return res.status(httpStatus.CONFLICT).json({
				success: false,
				message: getMessage("FRANCHISEE_PHONE_ALREADY_EXISTS", res.locals.language),
				data: null
			});
		}

		// Validate role
		if (!role || typeof role !== 'string' || !['manager', 'staff'].includes(role.toLowerCase())) {
			return res.status(httpStatus.BAD_REQUEST).json({
				success: false,
				message: getMessage("FRANCHISEE_INPUT_INVALID_ROLE", res.locals.language),
				data: null
			});
		}

		// Resolve password
		let userPassword = password;
		if (!userPassword) {
			if (role.toLowerCase() === 'manager') {
				userPassword = 'manager@123';
			} else if (role.toLowerCase() === 'staff') {
				userPassword = 'staff@123';
			}
		} else {
			// Validate custom password if provided (must contain at least one letter and one number)
			if (typeof userPassword !== 'string' || userPassword.length < 8 || userPassword.length > 100) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_PASSWORD", res.locals.language),
					data: null
				});
			}
			if (!userPassword.match(/\d/) || !userPassword.match(/[a-zA-Z]/)) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_PASSWORD", res.locals.language),
					data: null
				});
			}
		}

		// Validate creatorObj if provided
		if (creatorObj) {
			if (typeof creatorObj !== 'object') {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_CREATOROBJ", res.locals.language),
					data: null
				});
			}

			if (!creatorObj.creatorId || typeof creatorObj.creatorId !== 'string') {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_CREATORID", res.locals.language),
					data: null
				});
			}

			if (!creatorObj.creatorRole || !['FranchiseeUser', 'FranchisorUser'].includes(creatorObj.creatorRole)) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_CREATORROLE", res.locals.language),
					data: null
				});
			}

			// Verify creator exists
			if (creatorObj.creatorRole === 'FranchiseeUser') {
				const franchiseeCreator = await FranchiseeUser.findOne({ _id: creatorObj.creatorId, isDeleted: false });
				if (!franchiseeCreator) {
					return res.status(httpStatus.NOT_FOUND).json({
						success: false,
						message: getMessage("FRANCHISEE_INPUT_INVALID_FRANCHISEEUSER_NOT_FOUND", res.locals.language),
						data: null
					});
				}
			} else if (creatorObj.creatorRole === 'FranchisorUser') {
				const franchisorCreator = await FranchisorUser.findOne({ _id: creatorObj.creatorId, isDeleted: false });
				if (!franchisorCreator) {
					return res.status(httpStatus.NOT_FOUND).json({
						success: false,
						message: getMessage("FRANCHISEE_INPUT_INVALID_FRANCHISORUSER_NOT_FOUND", res.locals.language),
						data: null
					});
				}
			}
		}

		// ===== BUILD USER DATA =====
		const userData = {
			franchiseeInfoId: franchiseeInfoId.trim(),
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			email: normalizedEmail,
			phonenoPrefix: phonenoPrefix.trim(),
			phoneno: phoneno.trim(),
			password: userPassword,
			role: role.toLowerCase(),
			isEmailVerified: true,
			isPhonenoVerified: true
		};

		// Add creatorObj if valid
		if (creatorObj && creatorObj.creatorId && creatorObj.creatorRole) {
			userData.creatorObj = {
				creatorId: creatorObj.creatorId,
				creatorRole: creatorObj.creatorRole
			};
		}

		// ===== SAVE TO DATABASE =====
		const franchiseeUser = new FranchiseeUser(userData);
		await franchiseeUser.save();

		res.status(httpStatus.CREATED).json({
			success: true,
			message: getMessage("FRANCHISEE_USER_CREATED", res.locals.language),
			data: franchiseeUser
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: getMessage(err.message, res.locals.language),
			data: null
		});
	}
};

/**
 * Update an existing FranchiseeUser
 * PATCH /franchisor/franchisee-user/:id
 * Allows updating firstName, lastName, email, phone, role with same validations as create
 */
const updateFranchiseeUser = async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body || {};

		// Find the franchisee user
		const franchiseeUser = await FranchiseeUser.findOne({ _id: id, isDeleted: false });
		if (!franchiseeUser) {
			return res.status(httpStatus.NOT_FOUND).json({
				success: false,
				message: getMessage("FRANCHISEE_USER_NOT_FOUND", res.locals.language),
				data: null
			});
		}

		// Validate and update firstName if provided
		if (updates.firstName !== undefined && updates.firstName !== null) {
			if (typeof updates.firstName !== 'string' || !updates.firstName.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_FIRSTNAME", res.locals.language),
					data: null
				});
			}
			franchiseeUser.firstName = updates.firstName.trim();
		}

		// Validate and update lastName if provided
		if (updates.lastName !== undefined && updates.lastName !== null) {
			if (typeof updates.lastName !== 'string' || !updates.lastName.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_LASTNAME", res.locals.language),
					data: null
				});
			}
			franchiseeUser.lastName = updates.lastName.trim();
		}

		// Validate and update email if provided
		if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
			if (!validator.isEmail(updates.email)) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language),
					data: null
				});
			}

			const normalizedEmail = updates.email.trim().toLowerCase();
			if (normalizedEmail !== franchiseeUser.email) {
				const existingEmail = await FranchiseeUser.findOne({
					email: normalizedEmail,
					_id: { $ne: id },
					isDeleted: false
				});
				if (existingEmail) {
					return res.status(httpStatus.CONFLICT).json({
						success: false,
						message: getMessage("FRANCHISEE_EMAIL_ALREADY_EXISTS", res.locals.language),
						data: null
					});
				}
			}

			franchiseeUser.email = normalizedEmail;
		}

		// Validate and update phone if provided
		if ((updates.phoneno !== undefined && updates.phoneno !== null) || (updates.phonenoPrefix !== undefined && updates.phonenoPrefix !== null)) {
			const newPhonePrefix = updates.phonenoPrefix !== undefined ? updates.phonenoPrefix : franchiseeUser.phonenoPrefix;
			const newPhone = updates.phoneno !== undefined ? updates.phoneno : franchiseeUser.phoneno;

			if (typeof newPhonePrefix !== 'string' || !newPhonePrefix.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_PHONENOPREFIX", res.locals.language),
					data: null
				});
			}
			if (typeof newPhone !== 'string' || !newPhone.trim()) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID_PHONENO", res.locals.language),
					data: null
				});
			}

			// Check uniqueness only if changing phone
			if (newPhone !== franchiseeUser.phoneno || newPhonePrefix !== franchiseeUser.phonenoPrefix) {
				const existingPhone = await FranchiseeUser.findOne({
					phonenoPrefix: newPhonePrefix.trim(),
					phoneno: newPhone.trim(),
					_id: { $ne: id },
					isDeleted: false
				});
				if (existingPhone) {
					return res.status(httpStatus.CONFLICT).json({
						success: false,
						message: getMessage("FRANCHISEE_PHONE_ALREADY_EXISTS", res.locals.language),
						data: null
					});
				}
			}

			franchiseeUser.phonenoPrefix = newPhonePrefix.trim();
			franchiseeUser.phoneno = newPhone.trim();
		}

		// Validate and update role if provided
		if (updates.role !== undefined && updates.role !== null) {
			if (typeof updates.role !== 'string' || !['manager', 'staff'].includes(updates.role.toLowerCase())) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_INPUT_INVALID", res.locals.language),
					data: null
				});
			}
			franchiseeUser.role = updates.role.toLowerCase();
		}

		// Validate and update password if provided
		if (updates.password !== undefined && updates.password !== null && updates.password !== '') {
			if (typeof updates.password !== 'string' || updates.password.length < 8 || updates.password.length > 100) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_PASSWORD_LENGTH_INVALID", res.locals.language),
					data: null
				});
			}
			if (!updates.password.match(/\d/) || !updates.password.match(/[a-zA-Z]/)) {
				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: getMessage("FRANCHISEE_PASSWORD_FORMAT_INVALID", res.locals.language),
					data: null
				});
			}
			franchiseeUser.password = updates.password;
		}

		// Update other optional fields
		const optionalFields = ['isEmailVerified', 'isPhonenoVerified', 'isActive', 'deviceType', 'devicePushKey'];
		optionalFields.forEach(field => {
			if (updates[field] !== undefined && updates[field] !== null) {
				franchiseeUser[field] = updates[field];
			}
		});

		franchiseeUser.updatedAt = Date.now();
		await franchiseeUser.save();

		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISEE_USER_UPDATED_SUCCESS", res.locals.language),
			data: franchiseeUser
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: err.message,
			data: null
		});
	}
};

/**
 * Get a single FranchiseeUser by ID
 * GET /franchisor/franchisee-user/:id
 */
const getFranchiseeUser = async (req, res) => {
	try {
		const { id } = req.params;
		const franchiseeUser = await FranchiseeUser.findOne({ _id: id, isDeleted: false });
		if (!franchiseeUser) {
			return res.status(httpStatus.NOT_FOUND).json({
				success: false,
				message: getMessage("FRANCHISEE_USER_NOT_FOUND", res.locals.language),
				data: null
			});
		}
		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISEE_USER_FETCH_SUCCESS", res.locals.language),
			data: franchiseeUser
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: err.message,
			data: null
		});
	}
};

/**
 * Get list of FranchiseeUsers with filtering and pagination
 * GET /franchisor/franchisee-users
 * Query parameters: firstName, lastName, email, phoneno, role, franchiseeInfoId, isActive, searchKey, limit, skip
 * searchKey: Search across firstName, lastName, and email fields using case-insensitive regex
 */
const getFranchiseeUsersList = async (req, res) => {
	try {
		// Determine franchiseeInfoId based on user type
		let { firstName, lastName, email, phoneno, role, franchiseeInfoId, isActive, searchKey, limit = 20, skip = 0 } = req.query;

		// If manager, force franchiseeInfoId from req.franchiseeUser
		if (req.franchiseeUser && req.franchiseeUser.role === 'manager') {
			franchiseeInfoId = req.franchiseeUser.franchiseeInfoId;
		} else if (req.franchisorUser) {
			// If franchisorUser, allow franchiseeInfoId from req.body if provided
			if (req.body && req.body.franchiseeInfoId) {
				franchiseeInfoId = req.body.franchiseeInfoId;
			}
		}

		const filter = { isDeleted: false };

		// Add searchKey filter for firstName, lastName, and email using regex (case-insensitive)
		if (searchKey) {
			filter.$or = [
				{ firstName: { $regex: searchKey, $options: 'i' } },
				{ lastName: { $regex: searchKey, $options: 'i' } },
				{ email: { $regex: searchKey, $options: 'i' } }
			];
		}

		// Add individual filters if provided (overrides searchKey for that field)
		if (firstName) {
			filter.firstName = { $regex: firstName, $options: 'i' }; // Case-insensitive regex match
		}
		if (lastName) {
			filter.lastName = { $regex: lastName, $options: 'i' }; // Case-insensitive regex match
		}
		if (email) {
			filter.email = { $regex: email, $options: 'i' }; // Case-insensitive regex match
		}
		if (phoneno) {
			filter.phoneno = { $regex: phoneno, $options: 'i' }; // Case-insensitive regex match
		}
		if (role) {
			filter.role = role;
		}
		if (franchiseeInfoId) {
			filter.franchiseeInfoId = franchiseeInfoId;
		}
		if (isActive !== undefined) {
			filter.isActive = String(isActive).toLowerCase() === 'true';
		}

		// Parse limit and skip as integers
		const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // Max 100, default 20
		const pageSkip = Math.max(0, parseInt(skip) || 0);

		// Get total count for pagination info
		const totalCount = await FranchiseeUser.countDocuments(filter);

		const franchiseeUsers = await FranchiseeUser.find(filter)
			.sort({ createdAt: -1 })
			.limit(pageLimit)
			.skip(pageSkip);

		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISEE_USER_LIST_FETCH_SUCCESS", res.locals.language),
			data: franchiseeUsers,
			count: franchiseeUsers.length,
			totalCount: totalCount,
			pagination: {
				limit: pageLimit,
				skip: pageSkip,
				page: Math.floor(pageSkip / pageLimit) + 1,
				totalPages: Math.ceil(totalCount / pageLimit)
			}
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: err.message,
			data: null
		});
	}
};

/**
 * Delete a FranchiseeUser (soft delete)
 * DELETE /franchisor/franchisee-user/:id
 * Marks user as deleted without removing from database
 */
const deleteFranchiseeUser = async (req, res) => {
	try {
		const { id } = req.params;
		const franchiseeUser = await FranchiseeUser.findOne({ _id: id, isDeleted: false });
		if (!franchiseeUser) {
			return res.status(httpStatus.NOT_FOUND).json({
				success: false,
				message: getMessage("FRANCHISEE_USER_NOT_FOUND", res.locals.language),
				data: null
			});
		}

		franchiseeUser.isDeleted = true;
		franchiseeUser.updatedAt = Date.now();
		await franchiseeUser.save();

		res.status(httpStatus.OK).json({
			success: true,
			message: getMessage("FRANCHISEE_USER_DELETED_SUCCESS", res.locals.language),
			data: null
		});
	} catch (err) {
		res.status(httpStatus.OK).json({
			success: false,
			message: err.message,
			data: null
		});
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

/**
 * Bulk insert BadgeMaster records
 * POST /franchisor/badge-masters/bulk-insert
 * Body: Array of badge master objects
 */
const bulkInsertBadgeMasters = async (req, res) => {
	try {
		if (!Array.isArray(req.body) || req.body.length === 0) {
			return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'Request body must be a non-empty array', data: null });
		}
		const inserted = await BadgeMaster.insertMany(req.body, { ordered: false });
		res.status(httpStatus.CREATED).json({ success: true, message: 'Badge masters inserted', data: inserted });
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
	deleteFranchisorUser,
	signinFranchisorUser,
	signoutFranchisorUser,
	createFranchiseeInfo,
	updateFranchiseeInfo,
	getFranchiseeInfoList,
	createFranchiseeUser,
	updateFranchiseeUser,
	getFranchiseeUser,
	getFranchiseeUsersList,
	deleteFranchiseeUser,
	bulkInsertXpRules,
	bulkInsertBadges,
	bulkInsertBadgeMasters
};