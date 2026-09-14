const cloudinary = require('cloudinary').v2;

const getCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

// ─── Upload Logo ──────────────────────────────────────────────────────────────
const uploadLogo = async (req, res) => {
  try {
    const { imageData, subdomain } = req.body;
    if (!imageData) return res.status(400).json({ success: false, message: 'No image data provided.' });

    const cl = getCloudinary();
    const result = await cl.uploader.upload(imageData, {
      folder: `nexusora-books/${subdomain || 'general'}`,
      public_id: 'company-logo',
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'center' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error('[Upload] Logo error:', JSON.stringify(error));
    res.status(500).json({ success: false, message: 'Logo upload failed: ' + (error?.message || error?.error?.message || JSON.stringify(error)) });
  }
};

// ─── Upload Letterhead ────────────────────────────────────────────────────────
const uploadLetterhead = async (req, res) => {
  try {
    const { imageData, subdomain } = req.body;
    if (!imageData) return res.status(400).json({ success: false, message: 'No image data provided.' });

    console.log('[Upload] Letterhead upload starting for:', subdomain);
    console.log('[Upload] Cloudinary config:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY ? '***set***' : 'MISSING',
      api_secret: process.env.CLOUDINARY_API_SECRET ? '***set***' : 'MISSING',
    });

    const cl = getCloudinary();
   const result = await cl.uploader.upload(imageData, {
      folder: `nexusora-books/${subdomain || 'general'}/letterheads`,
      public_id: 'company-letterhead',
      overwrite: true,
      timeout: 300000,
      chunk_size: 6000000,
    });

    console.log('[Upload] Letterhead success:', result.secure_url);
    res.json({ success: true, url: result.secure_url, message: 'Letterhead uploaded.' });
  } catch (error) {
    console.error('[Upload] Letterhead error full:', JSON.stringify(error));
    res.status(500).json({
      success: false,
      message: 'Letterhead upload failed: ' + (error?.message || error?.error?.message || JSON.stringify(error)),
    });
  }
};

// Upload a source document (receipt, payment voucher, contract...) for a record.
// Accepts an image or a PDF as base64 in fileData. Returns the URL + Cloudinary
// public_id so the caller can link it to a voucher (and delete it later).
const uploadDocument = async (req, res) => {
  try {
    const { fileData, subdomain, filename } = req.body;
    if (!fileData) return res.status(400).json({ success: false, message: 'No file data provided.' });

    const cl = getCloudinary();
    const result = await cl.uploader.upload(fileData, {
      folder: `nexusora-books/${subdomain || 'general'}/documents`,
      resource_type: 'auto',      // accepts images AND pdf/raw
      use_filename: true,
      unique_filename: true,
      timeout: 300000,
      chunk_size: 6000000,
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      filename: filename || result.original_filename || 'document',
      message: 'Document uploaded.',
    });
  } catch (error) {
    console.error('[Upload] Document error:', JSON.stringify(error));
    res.status(500).json({ success: false, message: 'Document upload failed: ' + (error?.message || error?.error?.message || JSON.stringify(error)) });
  }
};

// Delete a document from Cloudinary by public_id (when a user removes an attachment).
const deleteDocument = async (req, res) => {
  try {
    const { publicId, resourceType } = req.body;
    if (!publicId) return res.status(400).json({ success: false, message: 'No publicId provided.' });
    const cl = getCloudinary();
    await cl.uploader.destroy(publicId, { resource_type: resourceType || 'image' });
    res.json({ success: true, message: 'Document deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed: ' + (error?.message || 'unknown') });
  }
};

module.exports = { uploadLogo, uploadLetterhead, uploadDocument, deleteDocument };