const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const path = require('path');
const multerS3 = require('multer-s3')
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const s3 = new S3Client({
    credentials: {
        secretAccessKey: process.env.S3_SECRET_KEY,
        accessKeyId: process.env.S3_ACCESS_KEY
    },
    region: process.env.S3_REGION
})

const playerProfilePictureStorage = multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
        cb(null, Date.now().toString())
    }
})

const playerProfilePictureUpload = multer({
    storage: playerProfilePictureStorage,
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(gif|png|jpg|jpeg|heif|heic|pdf|GIF| JPEG|JPG|PNG|HEIF|HEIC|PDF)$/)) {
            return cb(new Error('Please upload an image file'))
        }
        cb(undefined, true)
    }
})


module.exports = { 
    playerProfilePictureUpload
}