const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.streamUpload = (buffer, options = {}) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
            if (result) resolve(result);
            else reject(err);
        });
        stream.end(buffer);
    });

// Deletes an old asset by public_id. Never throws — a failed cleanup
// shouldn't break the request that's already succeeded.
exports.destroyImage = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('Cloudinary cleanup failed:', err.message);
    }
};

exports.cloudinary = cloudinary;