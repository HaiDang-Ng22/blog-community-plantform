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

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLower();

        if (!allowedExtensions.Contains(extension))
            return BadRequest("Định dạng tập tin không hỗ trợ.");

        try
        {
            using var stream = file.OpenReadStream();
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = "zynk_uploads",
                UseFilename = true,
                UniqueFilename = true,
                Overwrite = false
            };

            var uploadResult = await _cloudinary.UploadAsync(uploadParams);

            if (uploadResult.Error != null)
            {
                Console.WriteLine($"Cloudinary Error: {uploadResult.Error.Message}");
                return StatusCode(500, new { message = "Lỗi khi tải ảnh lên Cloudinary." });
            }

            // Trả về URL bảo mật (HTTPS) từ Cloudinary để frontend sử dụng
            return Ok(new { url = uploadResult.SecureUrl.ToString() });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Exception during upload: {ex.Message}");
            return StatusCode(500, new { message = "Lỗi hệ thống khi tải ảnh." });
        }
    }
}
