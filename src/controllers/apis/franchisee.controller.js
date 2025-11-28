
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
 * FranchiseeUser Signin
 * POST /franchisee/auth/signin
 * Required fields: email, password, role
 * Returns JWT token and user data if successful
 */
const signinFranchiseeUser = async (req, res) => {
	try {
		const { email, password } = req.body;
		const franchiseeUser = await FranchiseeUser.findByCredentials(email, password);
		if (!franchiseeUser.isEmailVerified) {
			return res.status(httpStatus.OK).json({ success: false, message: getMessage("EMAIL_NOT_VERIFIED", res.locals.language), data: null });
		}
		const token = await franchiseeUser.generateAuthToken();
		res.status(httpStatus.OK).json({ success: true, message: getMessage("FRANCHISEE_SIGNIN_SUCCESS", res.locals.language), data: { franchiseeUser, token } });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};

/**
 * Handles the signout process for a franchisee user.
 * Clears the user's token and ends the session.
 * POST /franchisee/auth/signout
 * Requires authentication middleware to set req.franchiseeUser
 */
const signoutFranchiseeUser = async (req, res) => {
	try {
		req.franchiseeUser.token = '';
		await req.franchiseeUser.save();
		res.status(httpStatus.OK).json({ success: true, message: getMessage("FRANCHISEE_SIGNOUT_SUCCESS", res.locals.language), data: null });
	} catch (err) {
		res.status(httpStatus.OK).json({ success: false, message: err.message, data: null });
	}
};


/**
 * Get Franchisee Data
 * GET /franchisee/info
 * Query params: id (optional), name, phone, email, latitude, longitude, radius (in km)
 * Returns single franchisee if id provided, otherwise returns filtered list
 */
const getFranchiseeData = catchAsync(async (req, res) => {
    try {
        const { id, name, phone, email, latitude, longitude, radius } = req.query;

        // If ID is provided, return single franchisee
        if (id) {
            const franchisee = await FranchiseeInfo.find({ 
                _id: id, 
                isDeleted: false 
            }).populate({
                path: 'franchisorInfoId',
                select: 'name brandName'
            })

            if (!franchisee) {
                return res.status(httpStatus.OK).json({ 
                    success: false, 
                    message: getMessage("FRANCHISEE_NOT_FOUND", res.locals.language), 
                    data: null 
                });
            }

            return res.status(httpStatus.OK).json({ 
                success: true, 
                message: getMessage("FRANCHISEE_FETCHED_SUCCESS", res.locals.language), 
                data: { franchisees: franchisee, totalCount: 1}
            });
        }

        // Build filter query for list
        let filter = { isDeleted: false };

        // Filter by name (case-insensitive partial match)
        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }

        // Filter by phone prefix (exact match)
        if (req.query.phonePrefix) {
            filter.phonePrefix = req.query.phonePrefix;
        }

        // Filter by phone number (partial match)
        if (phone) {
            filter.phone = { $regex: phone, $options: 'i' };
        }

        // Filter by email (case-insensitive partial match)
        if (email) {
            filter.email = { $regex: email, $options: 'i' };
        }

        // Filter by geo location (radius search)
        if (latitude && longitude) {
            const searchRadius = radius ? parseFloat(radius) : 10; // default 10km
            const radiusInRadians = searchRadius / 6371; // Earth's radius in km

            filter['location.coordinates.latitude'] = {
                $gte: parseFloat(latitude) - radiusInRadians * (180 / Math.PI),
                $lte: parseFloat(latitude) + radiusInRadians * (180 / Math.PI)
            };

            filter['location.coordinates.longitude'] = {
                $gte: parseFloat(longitude) - radiusInRadians * (180 / Math.PI),
                $lte: parseFloat(longitude) + radiusInRadians * (180 / Math.PI)
            };
        }

        // Fetch franchisees with filters
        const franchisees = await FranchiseeInfo.find(filter)
            .populate({
                path: 'franchisorInfoId',
                select: 'name brandName'
            })
            .sort({ createdAt: -1 });

        res.status(httpStatus.OK).json({ 
            success: true, 
            message: getMessage("FRANCHISEES_FETCHED_SUCCESS", res.locals.language), 
            data: {franchisees, totalCount: franchisees.length }
        });

    } catch (err) {
        res.status(httpStatus.OK).json({ 
            success: false, 
            message: err.message, 
            data: null 
        });
    }
});

module.exports = {
	signinFranchiseeUser,
	signoutFranchiseeUser,
    getFranchiseeData
};