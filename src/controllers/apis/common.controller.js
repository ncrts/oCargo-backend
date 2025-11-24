// Core dependencies and utilities
const path = require('path');
const base64 = require('base-64');
const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const randomstring = require('randomstring');

const { getMessage } = require("../../../config/languageLocalization");

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

module.exports = { 
    commonS3FileUploadedKeys,
    sendRequestBodyData
}