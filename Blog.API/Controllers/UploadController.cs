using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Mvc;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/upload")]
public class UploadController : ControllerBase
{
    private readonly Cloudinary? _cloudinary;
    private readonly ILogger<UploadController> _logger;

    public UploadController(IConfiguration configuration, ILogger<UploadController> logger)
    {
        _logger = logger;

        var cloudinarySettings = configuration.GetSection("CloudinarySettings");
        var cloudName = cloudinarySettings["CloudName"]?.Trim();
        var apiKey = cloudinarySettings["ApiKey"]?.Trim();
        var apiSecret = cloudinarySettings["ApiSecret"]?.Trim();

        // Tolerate accidental whitespace in a JSON property name (for example "ApiSecret ").
        // The normal, documented key remains "ApiSecret".
        if (!IsConfiguredValue(apiSecret))
        {
            apiSecret = cloudinarySettings
                .GetChildren()
                .FirstOrDefault(item =>
                    !item.Key.Equals("ApiSecret", StringComparison.OrdinalIgnoreCase) &&
                    item.Key.Trim().Equals("ApiSecret", StringComparison.OrdinalIgnoreCase))
                ?.Value
                ?.Trim();
        }

        if (!IsConfiguredValue(cloudName) ||
            !IsConfiguredValue(apiKey) ||
            !IsConfiguredValue(apiSecret))
        {
            _logger.LogError(
                "Cloudinary is not configured. CloudName present: {HasCloudName}; ApiKey present: {HasApiKey}; ApiSecret present: {HasApiSecret}",
                IsConfiguredValue(cloudName),
                IsConfiguredValue(apiKey),
                IsConfiguredValue(apiSecret));
            return;
        }

        _cloudinary = new Cloudinary(new Account(cloudName, apiKey, apiSecret));
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Không có tập tin nào được chọn." });

        if (_cloudinary is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                code = "CLOUDINARY_NOT_CONFIGURED",
                message = "Cloudinary chưa được cấu hình đầy đủ trên máy chủ. Hãy kiểm tra CloudName, ApiKey và ApiSecret rồi khởi động lại API."
            });
        }

        var allowedImageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        var allowedVideoExtensions = new[] { ".mp4", ".mov", ".avi", ".mkv" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

        var isVideo = allowedVideoExtensions.Contains(extension);
        var isImage = allowedImageExtensions.Contains(extension);

        if (!isImage && !isVideo)
            return BadRequest(new { message = "Định dạng tập tin không được hỗ trợ." });

        try
        {
            using var stream = file.OpenReadStream();
            string? secureUrl = null;
            string? errorMessage = null;

            if (isVideo)
            {
                var uploadParams = new VideoUploadParams
                {
                    File = new FileDescription(file.FileName, stream),
                    Folder = "zynk_reels",
                    UniqueFilename = true,
                    Overwrite = false
                };
                var uploadResult = await _cloudinary.UploadAsync(uploadParams);
                if (uploadResult.Error != null) errorMessage = uploadResult.Error.Message;
                else secureUrl = uploadResult.SecureUrl?.ToString();
            }
            else
            {
                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription(file.FileName, stream),
                    Folder = "zynk_uploads",
                    UniqueFilename = true,
                    Overwrite = false
                };
                var uploadResult = await _cloudinary.UploadAsync(uploadParams);
                if (uploadResult.Error != null) errorMessage = uploadResult.Error.Message;
                else secureUrl = uploadResult.SecureUrl?.ToString();
            }

            if (!string.IsNullOrWhiteSpace(errorMessage))
            {
                _logger.LogError("Cloudinary upload failed: {CloudinaryError}", errorMessage);

                var invalidSignature = errorMessage.Contains("Invalid Signature", StringComparison.OrdinalIgnoreCase);
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    code = invalidSignature ? "CLOUDINARY_INVALID_CREDENTIALS" : "CLOUDINARY_UPLOAD_FAILED",
                    message = invalidSignature
                        ? "Cấu hình Cloudinary không hợp lệ. Hãy kiểm tra CloudName, ApiKey và ApiSecret có thuộc cùng một Product Environment."
                        : "Cloudinary không thể xử lý tập tin. Vui lòng thử lại."
                });
            }

            if (string.IsNullOrWhiteSpace(secureUrl))
            {
                _logger.LogError("Cloudinary upload completed without a secure URL.");
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    code = "CLOUDINARY_URL_MISSING",
                    message = "Không nhận được URL từ máy chủ lưu trữ. Vui lòng thử lại."
                });
            }

            return Ok(new { url = secureUrl });
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unexpected error while uploading {FileName} to Cloudinary.", file.FileName);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                code = "UPLOAD_FAILED",
                message = "Lỗi hệ thống khi tải tập tin. Vui lòng thử lại."
            });
        }
    }

    private static bool IsConfiguredValue(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        !value.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase);
}
