const path = require('path')
const fs = require('fs')
const uploadPath = path.resolve(__dirname, '../../public/uploads')
const unlinkFile = async (filePath) => {
    let deletePath = uploadPath+filePath
    if (fs.existsSync(deletePath)) {
        fs.unlinkSync(deletePath);
    }
}
module.exports = unlinkFile;