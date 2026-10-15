using System.Security.Claims;
using Blog.API.Extensions;

namespace Blog.API.Security;

/// <summary>
/// Defense-in-depth middleware for /api/admin endpoints.
/// Ensures that any request reaching /api/admin/* is authenticated and carries a valid Admin role.
/// </summary>
public class AdminSecurityMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AdminSecurityMiddleware> _logger;

    public AdminSecurityMiddleware(RequestDelegate next, ILogger<AdminSecurityMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/api/admin"))
        {
            var user = context.User;
            var isAuthenticated = user.Identity != null && user.Identity.IsAuthenticated;
            var isAdmin = isAuthenticated && (user.IsInRole("Admin") || user.HasClaim(c => (c.Type == ClaimTypes.Role || c.Type == "role") && c.Value.Equals("Admin", StringComparison.OrdinalIgnoreCase)));

            if (!isAuthenticated)
            {
                _logger.LogWarning("[UNAUTHORIZED ADMIN ROUTE ACCESS] Anonymous request to {Path} from IP {IP}", context.Request.Path, context.Connection.RemoteIpAddress);
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json; charset=utf-8";
                await context.Response.WriteAsJsonAsync(new { message = "Yêu cầu đăng nhập tài khoản Quản trị viên." });
                return;
            }

            if (!isAdmin)
            {
                var userId = user.GetUserId();
                _logger.LogWarning("[FORBIDDEN ADMIN ROUTE ACCESS] User {UserId} attempted unauthorized access to {Path} from IP {IP}", userId, context.Request.Path, context.Connection.RemoteIpAddress);
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json; charset=utf-8";
                await context.Response.WriteAsJsonAsync(new { message = "Truy cập bị từ chối: Tài khoản không có quyền Quản trị viên." });
                return;
            }
        }

        await _next(context);
    }
}
