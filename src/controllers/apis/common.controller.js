// Core dependencies and utilities
const path = require('path');
const base64 = require('base-64');
const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const randomstring = require('randomstring');

const { getMessage } = require("../../../config/languageLocalization");
const AvatarMaster = require('../../models/avatar.model');
const Food = require('../../models/food.model');
const BadgeMaster = require('../../models/badge.master.model');

const commonS3FileUploadedKeys = catchAsync(async (req, res) => {
    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Common S3 file uploaded keys retrieved successfully',
        data: {
            fileKey: req.file?.key || null,
            fileLocation: req.file?.location || null
        }
    });
})

const sendRequestBodyData = catchAsync(async (req, res) => {
    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Request body data sent successfully',
        data: req.body
    });
});


const insertMultipleAvatars = catchAsync(async (req, res) => {
    const avatars = req.body.avatars; // Expecting [{ name, imageUrl }, ...]
    if (!Array.isArray(avatars) || avatars.length === 0) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: 'Avatars array is required in request body',
        });
    }

    const insertedAvatars = await AvatarMaster.insertMany(avatars);

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: 'Avatars inserted successfully',
        data: insertedAvatars
    });
});

const getAllAvatars = catchAsync(async (req, res) => {
    const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';
    const avatars = await AvatarMaster.find({ isDeleted: false }).select('_id name imageUrl').lean();
    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Avatar list retrieved successfully',
        data: { s3BaseUrl, avatars }
    });
});

const insertMultipleFoods = catchAsync(async (req, res) => {
    const foods = req.body.foods;
    if (!Array.isArray(foods) || foods.length === 0) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: 'Foods array is required in request body',
        });
    }

    const insertedFoods = await Food.insertMany(foods);

    return res.status(httpStatus.CREATED).json({
        success: true,
        message: 'Foods inserted successfully',
        data: insertedFoods
    });
});

const getAllFoods = catchAsync(async (req, res) => {
    const language = res.locals.language || 'en_us';
    const foods = await Food.find({ isDeleted: false }).select('_id name').lean();

    const transformedFoods = foods.map(food => ({
        id: food._id,
        name: food.name?.[language] || food.name?.en_us || food.name?.fr_fr || ''
    }));

    return res.status(httpStatus.OK).json({
        success: true,
        message: getMessage("FOOD_LIST_RETRIEVED_SUCCESSFULLY", language),
        data: transformedFoods
    });
});


const getAllBadges = catchAsync(async (req, res) => {
    const s3BaseUrl = process.env.S3_BUCKET_NAME && process.env.S3_REGION ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/` : '';
    const badges = await BadgeMaster.find().select('_id name iconUrl')

    let badgeList = [];
    if (badges.length > 0) {
        badges.forEach(badge => {
            badgeList.push({
                id: badge._id,
                name: badge.name,
                iconUrl: badge.iconUrl ? s3BaseUrl + badge.iconUrl : null
            });
        });
    }

    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Badge list retrieved successfully',
        data: { s3BaseUrl, badges: badgeList }
    });
});

module.exports = {
    commonS3FileUploadedKeys,
    sendRequestBodyData,
    insertMultipleAvatars,
    getAllAvatars,
    insertMultipleFoods,
    getAllFoods,
    getAllBadges
}