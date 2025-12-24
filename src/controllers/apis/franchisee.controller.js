
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
const ClientProfile = require('../../models/clientProfile.model');

const Restaurant = require('../../models/restaurant.model');


const { getMessage } = require("../../../config/languageLocalization");

const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';


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
        const franchiseeInfo = await FranchiseeInfo.findById(franchiseeUser.franchiseeInfoId);
        res.status(httpStatus.OK).json({ success: true, message: getMessage("FRANCHISEE_SIGNIN_SUCCESS", res.locals.language), data: { franchiseeUser, franchiseeInfo, token } });
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
                data: { franchisees: franchisee, totalCount: 1 }
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
            data: { franchisees, totalCount: franchisees.length }
        });

    } catch (err) {
        res.status(httpStatus.OK).json({
            success: false,
            message: err.message,
            data: null
        });
    }
});



/**
 * Create Restaurant
 * POST /franchisee/restaurant
 * Validates input as per restaurant schema and creates a new restaurant
 */
const createRestaurant = catchAsync(async (req, res) => {
    const {
        franchiseeInfoId,
        name,
        description,
        backgroundImage,
        type,
        menuCardS3Key,
        openingHours,
        address,
        location
    } = req.body;

    const language = res.locals.language;

    // Determine franchiseeInfoId based on user type
    let usedFranchiseeInfoId = null;
    if (req.franchiseeUser && req.franchiseeUser.franchiseeInfoId) {
        // Franchisee user: use their franchiseeInfoId
        usedFranchiseeInfoId = req.franchiseeUser.franchiseeInfoId;
    } else if (req.franchisorUser) {
        // Franchisor user: require franchiseeInfoId in request body
        if (!franchiseeInfoId) {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_FRANCHISEE_INFO_ID_REQUIRED_FRANCHISOR", language), data: null });
        }
        usedFranchiseeInfoId = franchiseeInfoId;
    } else {
        return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: getMessage("UNAUTHORIZED", language), data: null });
    }

    // Validation
    if (!name || typeof name !== 'string') {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_NAME_REQUIRED", language), data: null });
    }
    if (description && typeof description !== 'string') {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_DESCRIPTION_INVALID", language), data: null });
    }
    if (backgroundImage && typeof backgroundImage !== 'string') {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_BACKGROUND_IMAGE_INVALID", language), data: null });
    }
    if (type && typeof type !== 'string') {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_TYPE_INVALID", language), data: null });
    }
    if (menuCardS3Key && typeof menuCardS3Key !== 'string') {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_MENU_CARD_INVALID", language), data: null });
    }
    // Validate openingHours if provided
    if (openingHours) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        for (const day of days) {
            if (openingHours[day]) {
                const { status, openTime, closeTime } = openingHours[day];
                if (status && !['open', 'close'].includes(status)) {
                    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_OPENING_HOURS_STATUS_INVALID", language) + ` (${day})`, data: null });
                }
                if (openTime && typeof openTime !== 'string') {
                    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_OPENING_HOURS_TIME_INVALID", language) + ` (${day})`, data: null });
                }
                if (closeTime && typeof closeTime !== 'string') {
                    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_OPENING_HOURS_TIME_INVALID", language) + ` (${day})`, data: null });
                }
            }
        }
    }
    // Validate address if provided
    if (address) {
        if (typeof address !== 'object') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_INVALID", language), data: null });
        }
        const { line1, city, state, postalCode, country } = address;
        if (line1 && typeof line1 !== 'string') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_LINE_INVALID", language), data: null });
        }
        if (city && typeof city !== 'string') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_CITY_INVALID", language), data: null });
        }
        if (state && typeof state !== 'string') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_STATE_INVALID", language), data: null });
        }
        if (postalCode && typeof postalCode !== 'string') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_POSTAL_CODE_INVALID", language), data: null });
        }
        if (country && typeof country !== 'string') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_COUNTRY_INVALID", language), data: null });
        }
    }
    // Validate location if provided
    if (location) {
        if (typeof location !== 'object') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_INVALID", language), data: null });
        }
        const { placeId, coordinates } = location;
        if (placeId && typeof placeId !== 'string') {
            return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_PLACE_ID_INVALID", language), data: null });
        }
        if (coordinates) {
            if (typeof coordinates !== 'object') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_COORDINATES_INVALID", language), data: null });
            }
            const { latitude, longitude } = coordinates;
            if (latitude && typeof latitude !== 'number') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_LATITUDE_INVALID", language), data: null });
            }
            if (longitude && typeof longitude !== 'number') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_LONGITUDE_INVALID", language), data: null });
            }
        }
    }

    // Check franchiseeInfoId exists
    const franchisee = await FranchiseeInfo.findOne({ _id: usedFranchiseeInfoId, isDeleted: false });
    if (!franchisee) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_FRANCHISEE_INFO_ID_INVALID", language), data: null });
    }

    // Create restaurant
    const restaurant = new Restaurant({
        franchiseeInfoId: usedFranchiseeInfoId,
        name,
        description,
        backgroundImage,
        type,
        menuCardS3Key,
        openingHours,
        address,
        location
    });
    await restaurant.save();
    res.status(httpStatus.OK).json({ success: true, message: getMessage("RESTAURANT_CREATED_SUCCESS", language), data: { restaurant } });
});

/**
 * Update Restaurant
 * PATCH /franchisee/restaurant/:id
 * Updates only fields present in req.body, with validation
 */
const updateRestaurant = catchAsync(async (req, res) => {
    const { id } = req.params;
    const language = res.locals.language;

    if (!id) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ID_REQUIRED", language), data: null });
    }
    const restaurant = await Restaurant.findOne({ _id: id, isDeleted: false });
    if (!restaurant) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: getMessage("RESTAURANT_NOT_FOUND", language), data: null });
    }

    // Authorization check: Franchisee users can only update their own restaurants
    if (req.franchiseeUser) {
        const userFranchiseId = req.franchiseeUser.franchiseeInfoId.toString();
        const restaurantFranchiseId = restaurant.franchiseeInfoId.toString();

        if (userFranchiseId !== restaurantFranchiseId) {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: getMessage("RESTAURANT_UPDATE_ACCESS_DENIED", language),
                data: null
            });
        }
    } else if (!req.franchisorUser) {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: getMessage("UNAUTHORIZED", language),
            data: null
        });
    }

    const allowedFields = [
        'franchiseeInfoId', 'name', 'description', 'backgroundImage', 'type', 'menuCardS3Key',
        'openingHours', 'address', 'location', 'isActive', 'isDeleted'
    ];
    const updates = {};
    for (const key of Object.keys(req.body)) {
        if (!allowedFields.includes(key)) continue;
        const value = req.body[key];
        // Validation per field
        if (key === 'franchiseeInfoId' && value) {
            // Only franchisor users can change franchiseeInfoId
            if (req.franchiseeUser) {
                return res.status(httpStatus.FORBIDDEN).json({
                    success: false,
                    message: getMessage("RESTAURANT_FRANCHISEE_ID_CHANGE_DENIED", language),
                    data: null
                });
            }
            const franchisee = await FranchiseeInfo.findOne({ _id: value, isDeleted: false });
            if (!franchisee) {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_FRANCHISEE_INFO_ID_INVALID", language), data: null });
            }
            updates.franchiseeInfoId = value;
        } else if (key === 'name' && value) {
            if (typeof value !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_NAME_REQUIRED", language), data: null });
            }
            updates.name = value;
        } else if (key === 'description' && value) {
            if (typeof value !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_DESCRIPTION_INVALID", language), data: null });
            }
            updates.description = value;
        } else if (key === 'backgroundImage' && value) {
            if (typeof value !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_BACKGROUND_IMAGE_INVALID", language), data: null });
            }
            updates.backgroundImage = value;
        } else if (key === 'type' && value) {
            if (typeof value !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_TYPE_INVALID", language), data: null });
            }
            updates.type = value;
        } else if (key === 'menuCardS3Key' && value) {
            if (typeof value !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_MENU_CARD_INVALID", language), data: null });
            }
            updates.menuCardS3Key = value;
        } else if (key === 'openingHours' && value) {
            if (typeof value !== 'object') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_INVALID", language), data: null });
            }
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            for (const day of days) {
                if (value[day]) {
                    const { status, openTime, closeTime } = value[day];
                    if (status && !['open', 'close'].includes(status)) {
                        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_OPENING_HOURS_STATUS_INVALID", language) + ` (${day})`, data: null });
                    }
                    if (openTime && typeof openTime !== 'string') {
                        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_OPENING_HOURS_TIME_INVALID", language) + ` (${day})`, data: null });
                    }
                    if (closeTime && typeof closeTime !== 'string') {
                        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_OPENING_HOURS_TIME_INVALID", language) + ` (${day})`, data: null });
                    }
                }
            }
            updates.openingHours = value;
        } else if (key === 'address' && value) {
            if (typeof value !== 'object') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_INVALID", language), data: null });
            }
            const { line1, city, state, postalCode, country } = value;
            if (line1 && typeof line1 !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_LINE_INVALID", language), data: null });
            }
            if (city && typeof city !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_CITY_INVALID", language), data: null });
            }
            if (state && typeof state !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_STATE_INVALID", language), data: null });
            }
            if (postalCode && typeof postalCode !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_POSTAL_CODE_INVALID", language), data: null });
            }
            if (country && typeof country !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ADDRESS_COUNTRY_INVALID", language), data: null });
            }
            updates.address = value;
        } else if (key === 'location' && value) {
            if (typeof value !== 'object') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_INVALID", language), data: null });
            }
            const { placeId, coordinates } = value;
            if (placeId && typeof placeId !== 'string') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_PLACE_ID_INVALID", language), data: null });
            }
            if (coordinates) {
                if (typeof coordinates !== 'object') {
                    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_COORDINATES_INVALID", language), data: null });
                }
                const { latitude, longitude } = coordinates;
                if (latitude && typeof latitude !== 'number') {
                    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_LATITUDE_INVALID", language), data: null });
                }
                if (longitude && typeof longitude !== 'number') {
                    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_LOCATION_LONGITUDE_INVALID", language), data: null });
                }
            }
            updates.location = value;
        } else if (key === 'isActive') {
            if (typeof value !== 'boolean') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_IS_ACTIVE_INVALID", language), data: null });
            }
            updates.isActive = value;
        } else if (key === 'isDeleted') {
            if (typeof value !== 'boolean') {
                return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_IS_DELETED_INVALID", language), data: null });
            }
            updates.isDeleted = value;
        }
    }
    updates.updatedAt = new Date();
    Object.assign(restaurant, updates);
    await restaurant.save();
    res.status(httpStatus.OK).json({ success: true, message: getMessage("RESTAURANT_UPDATED_SUCCESS", language), data: { restaurant } });
});


/**
 * Get Restaurant List or Single Restaurant
 * GET /franchisee/restaurant/list
 * Query params: franchiseeInfoId (required), name (optional), id (optional), page (optional), limit (optional)
 * Returns single restaurant if id provided, otherwise returns paginated filtered list
 */
const getRestaurantList = catchAsync(async (req, res) => {
    const { franchiseeInfoId, search, id, page, limit } = req.query;
    const language = res.locals.language;

    if (!franchiseeInfoId && !id) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_FRANCHISEE_INFO_ID_OR_ID_REQUIRED", language), data: null });
    }
    // Get single restaurant by id
    if (id) {
        const restaurant = await Restaurant.find({ _id: id, isDeleted: false })
            .populate({ path: 'franchiseeInfoId', select: 'name email phone address location' });
        if (!restaurant) {
            return res.status(httpStatus.NOT_FOUND).json({ success: false, message: getMessage("RESTAURANT_NOT_FOUND", language), data: null });
        }
        return res.status(httpStatus.OK).json({ success: true, message: getMessage("RESTAURANT_FETCHED_SUCCESS", language), data: { s3BaseUrl, restaurant, totalCount: 1 } });
    }
    // Build filter for list
    let filter = { isDeleted: false, franchiseeInfoId };

    // Search by restaurant name (case-insensitive)
    if (search) {
        filter.name = { $regex: search, $options: 'i' };
    }

    // Pagination parameters
    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 20;
    const skip = (pageNumber - 1) * pageSize;

    // Get total count for pagination
    const totalCount = await Restaurant.countDocuments(filter);

    // Get paginated restaurants
    const restaurants = await Restaurant.find(filter)
        .populate({ path: 'franchiseeInfoId', select: 'name email phone address location' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("RESTAURANTS_FETCHED_SUCCESS", language),
        data: {
            s3BaseUrl,
            restaurants,
            totalCount,
            pagination: {
                limit: pageSize,
                skip: skip,
                page: pageNumber,
                totalPages: totalPages
            }
        },
    });
});


/**
 * Delete Restaurant (soft delete)
 * PATCH /franchisee/restaurant/delete/:id
 * Sets isDeleted to true for the given restaurant id
 */
const deleteRestaurant = catchAsync(async (req, res) => {
    const { id } = req.params;
    const language = res.locals.language;

    if (!id) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: getMessage("RESTAURANT_ID_REQUIRED", language), data: null });
    }
    const restaurant = await Restaurant.findOne({ _id: id, isDeleted: false });
    if (!restaurant) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: getMessage("RESTAURANT_NOT_FOUND", language), data: null });
    }
    restaurant.isDeleted = true;
    restaurant.updatedAt = new Date();
    await restaurant.save();
    res.status(httpStatus.OK).json({ success: true, message: getMessage("RESTAURANT_DELETED_SUCCESS", language), data: null });
});

/**
 * Find Closest Franchisees by Location
 * POST /franchisee/find-nearest
 * Required fields: latitude, longitude
 * Optional fields: radius (in km, default 50), limit (default 10)
 * Returns franchisees sorted by distance from given coordinates
 */
const findNearestFranchisees = catchAsync(async (req, res) => {
    const { latitude, longitude, radius = 50, limit = 10 } = req.body;
    const language = res.locals.language;

    // Validate latitude
    if (!latitude || typeof latitude !== 'number') {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("LATITUDE_REQUIRED", language),
            data: null
        });
    }

    // Validate longitude
    if (!longitude || typeof longitude !== 'number') {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("LONGITUDE_REQUIRED", language),
            data: null
        });
    }

    // Validate latitude range (-90 to 90)
    if (latitude < -90 || latitude > 90) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("LATITUDE_INVALID_RANGE", language),
            data: null
        });
    }

    // Validate longitude range (-180 to 180)
    if (longitude < -180 || longitude > 180) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: getMessage("LONGITUDE_INVALID_RANGE", language),
            data: null
        });
    }

    // Validate radius
    const searchRadius = Math.min(Math.max(1, Number(radius) || 50), 500); // Min 1km, Max 500km
    const searchLimit = Math.min(Math.max(1, Number(limit) || 10), 100); // Min 1, Max 100

    // Find franchisees with valid coordinates
    const franchisees = await FranchiseeInfo.find({
        'location.coordinates.latitude': { $exists: true, $ne: null },
        'location.coordinates.longitude': { $exists: true, $ne: null },
        isDeleted: false
    }).populate({
        path: 'franchisorInfoId',
        select: 'name'
    });

    // Calculate distance for each franchisee
    const franchiseesWithDistance = franchisees.map(franchisee => {
        const lat1 = latitude;
        const lon1 = longitude;
        const lat2 = franchisee.location.coordinates.latitude;
        const lon2 = franchisee.location.coordinates.longitude;

        // Haversine formula to calculate distance in km
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return {
            _id: franchisee._id,
            name: franchisee.name,
            phone: franchisee.phone,
            phonePrefix: franchisee.phonePrefix,
            email: franchisee.email,
            icon: franchisee.icon ? (s3BaseUrl + franchisee.icon) : null,
            address: franchisee.address,
            location: franchisee.location,
            franchisorInfo: franchisee.franchisorInfoId,
            distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
            distanceUnit: 'km'
        };
    });

    // Filter by radius and sort by distance
    const nearbyFranchisees = franchiseesWithDistance
        .filter(f => f.distance <= searchRadius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, searchLimit);

    // If no franchisees found within radius
    if (nearbyFranchisees.length === 0) {
        return res.status(httpStatus.OK).json({
            success: true,
            message: getMessage("NO_FRANCHISEE_FOUND_IN_RADIUS", language),
            data: [],
            count: 0,
            searchParams: {
                latitude,
                longitude,
                radius: searchRadius,
                radiusUnit: 'km'
            }
        });
    }

    // Update user's favoriteOCargoFoodCourt if user is authenticated player
    if (req.player && req.player.clientProfileId && nearbyFranchisees.length > 0) {
        try {
            const closestFranchiseeId = nearbyFranchisees[0]._id;
            await ClientProfile.findByIdAndUpdate(
                req.player.clientProfileId,
                {
                    favoriteOCargoFoodCourt: closestFranchiseeId,
                    currentOcargoFoodCourt: closestFranchiseeId,
                    updatedAt: new Date()
                },
                { new: true }
            );
        } catch (err) {
            console.error('Error updating favorite food court:', err);
            // Continue without throwing error - updating favorite is optional
        }
    }

    // Return closest franchisee as primary + all within radius
    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("FRANCHISEE_FOUND_SUCCESS", language),
        data: {
            closest: nearbyFranchisees[0],
            nearby: nearbyFranchisees
        },
        count: nearbyFranchisees.length,
        searchParams: {
            latitude,
            longitude,
            radius: searchRadius,
            radiusUnit: 'km'
        }
    });
});

module.exports = {
    signinFranchiseeUser,
    signoutFranchiseeUser,
    getFranchiseeData,
    createRestaurant,
    updateRestaurant,
    getRestaurantList,
    deleteRestaurant,
    findNearestFranchisees
};

