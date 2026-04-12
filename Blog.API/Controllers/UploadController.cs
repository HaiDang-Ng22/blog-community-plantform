using Microsoft.AspNetCore.Mvc;

namespace Blog.API.Controllers;

[ApiController]
[Route("api/upload")]
public class UploadController : ControllerBase
{
    private readonly IWebHostEnvironment _environment;

    public UploadController(IWebHostEnvironment environment)
    {
        _environment = environment;
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

        // Đường dẫn tải lên: e:\Social\Blog.Web\uploads
        // Do Program.cs đang phục vụ Blog.Web là static files, ta lưu vào đó để truy cập dễ dàng
        var webPath = Path.Combine(_environment.ContentRootPath, "..", "Blog.Web", "uploads");
        
        if (!Directory.Exists(webPath))
            Directory.CreateDirectory(webPath);

        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(webPath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Trả về URL tương đối để frontend sử dụng
        return Ok(new { url = $"/uploads/{fileName}" });
    }
}
