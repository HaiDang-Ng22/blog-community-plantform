using Microsoft.AspNetCore.Mvc;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/upload")]
public class UploadController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly Cloudinary _cloudinary;

    public UploadController(IConfiguration configuration)
    {
        _configuration = configuration;

        var cloudName = _configuration["CloudinarySettings:CloudName"];
        var apiKey = _configuration["CloudinarySettings:ApiKey"];
        var apiSecret = _configuration["CloudinarySettings:ApiSecret"];

        var account = new Account(cloudName, apiKey, apiSecret);
        _cloudinary = new Cloudinary(account);
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage([FromForm] IFormFile file)
    {
        Console.WriteLine($"Upload attempt: {file?.FileName ?? "No file"}");
        
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Không có tập tin nào được chọn." });

        var allowedImageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        var allowedVideoExtensions = new[] { ".mp4", ".mov", ".avi", ".mkv" };
        var extension = Path.GetExtension(file.FileName).ToLower();

        bool isVideo = allowedVideoExtensions.Contains(extension);
        bool isImage = allowedImageExtensions.Contains(extension);

        if (!isImage && !isVideo)
            return BadRequest(new { message = "Định dạng tập tin không hỗ trợ." });

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

            if (errorMessage != null)
            {
                Console.WriteLine($"Cloudinary Error: {errorMessage}");
                return StatusCode(500, new { message = "Lỗi khi tải tập tin lên Cloudinary: " + errorMessage });
            }

            if (secureUrl == null)
            {
                return StatusCode(500, new { message = "Không nhận được URL từ máy chủ lưu trữ." });
            }

            return Ok(new { url = secureUrl });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Exception during upload: {ex.Message}");
            return StatusCode(500, new { message = "Lỗi hệ thống khi tải tập tin." });
        }
    }
}
