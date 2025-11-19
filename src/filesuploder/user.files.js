const multer = require('multer')
const path = require('path');
const uploadPath = path.resolve(__dirname, '../../public/uploads')

const userProfileStorage = multer.diskStorage({
    destination:uploadPath+'/profile-picture',
    filename:function(req,file,cb){
        cb(null,file.fieldname+'-'+Date.now()+path.extname(file.originalname))
    }
})
  
const userProfileUpload = multer({
    storage:userProfileStorage,
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg|jpeg|heif|heic|JPEG|JPG|PNG|HEIF|HEIC)$/)) {
            return cb(new Error('Please upload an image file'))
        }
        cb(undefined, true)
    }
})

module.exports = { 
    userProfileUpload
}