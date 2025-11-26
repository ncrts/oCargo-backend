// Core dependencies and utilities
const path = require('path');
const base64 = require('base-64');
const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const randomstring = require('randomstring');

const { getMessage } = require("../../../config/languageLocalization");
const AvatarMaster = require('../../models/avatar.model');

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
    const avatars = await AvatarMaster.find({isDeleted: false}).select('_id name imageUrl').lean();
    return res.status(httpStatus.OK).json({
        success: true,
        message: 'Avatar list retrieved successfully',
        data: { s3BaseUrl, avatars}
    });
});

module.exports = { 
    commonS3FileUploadedKeys,
    sendRequestBodyData,
    insertMultipleAvatars,
    getAllAvatars
}