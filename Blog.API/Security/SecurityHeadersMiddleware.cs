namespace Blog.API.Security;

/// <summary>
/// Adds standard HTTP security headers to protect against Clickjacking, MIME sniffing, and XSS.
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;

            if (!headers.ContainsKey("X-Content-Type-Options"))
                headers.Append("X-Content-Type-Options", "nosniff");

            if (!headers.ContainsKey("X-Frame-Options"))
                headers.Append("X-Frame-Options", "SAMEORIGIN");

            if (!headers.ContainsKey("X-XSS-Protection"))
                headers.Append("X-XSS-Protection", "1; mode=block");

            if (!headers.ContainsKey("Referrer-Policy"))
                headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

            if (!headers.ContainsKey("Permissions-Policy"))
                headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

            return Task.CompletedTask;
        });

        await _next(context);
    }
}
