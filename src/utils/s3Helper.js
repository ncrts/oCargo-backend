const { DeleteObjectCommand, S3Client } = require('@aws-sdk/client-s3');


/**
 * Helper function to delete a file from AWS S3.
 * @param {string} key - S3 object key to delete
 * @returns {Promise<any>} Result of the S3 delete operation
 */
const globalFileDeleteWithS3 = async (key) => {
    const client = new S3Client({
        credentials: {
            secretAccessKey: process.env.S3_SECRET_KEY,
            accessKeyId: process.env.S3_ACCESS_KEY
        },
        region: process.env.S3_REGION
    });
    const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key
    });
    try {
        return await client.send(command);
    } catch (err) {
        return err;
    }
};

module.exports = {
    globalFileDeleteWithS3
};