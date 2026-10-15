using System.Security.Claims;
using Blog.API.Extensions;
using Blog.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Blog.API.Security;

/// <summary>
/// Intercepts every authenticated request and verifies that any user claiming the 'Admin' role
/// actually exists in the database with Role == "Admin" and IsActive == true.
/// If an attacker attempts to forge a JWT with Role=Admin or uses an old revoked token,
/// the Admin role claim is stripped immediately, preventing any privilege escalation.
/// </summary>
public class RealAdminClaimsTransformation : IClaimsTransformation
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IMemoryCache _cache;
    private readonly ILogger<RealAdminClaimsTransformation> _logger;

    public RealAdminClaimsTransformation(
        IServiceProvider serviceProvider,
        IMemoryCache cache,
        ILogger<RealAdminClaimsTransformation> logger)
    {
        _serviceProvider = serviceProvider;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity == null || !principal.Identity.IsAuthenticated)
            return principal;

        // Check if the incoming token claims the Admin role
        var hasAdminRole = principal.Claims.Any(c =>
            (c.Type == ClaimTypes.Role || c.Type == "role") &&
            string.Equals(c.Value, "Admin", StringComparison.OrdinalIgnoreCase));

        if (!hasAdminRole)
            return principal;

        var userId = principal.GetUserId();
        if (userId == null)
        {
            return StripAdminRole(principal, "Token claims Admin role but does not contain a valid User ID claim.");
        }

        var cacheKey = $"REAL_ADMIN_CHECK_{userId.Value}";
        if (!_cache.TryGetValue(cacheKey, out bool isRealAdmin))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var user = await dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.Id == userId.Value)
                    .Select(u => new { u.Role, u.IsActive })
                    .FirstOrDefaultAsync();

                isRealAdmin = user != null &&
                              user.IsActive &&
                              string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase);

                // Cache the verification result for 30 seconds to minimize database overhead
                _cache.Set(cacheKey, isRealAdmin, TimeSpan.FromSeconds(30));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to verify real admin status from database for user {UserId}", userId.Value);
                // Fail secure: If DB cannot be reached, do not grant admin rights
                return StripAdminRole(principal, $"Database check error during Admin verification for user {userId.Value}");
            }
        }

        if (!isRealAdmin)
        {
            return StripAdminRole(principal, $"User {userId.Value} attempted to act as Admin, but is NOT an active Admin in the database.");
        }

        return principal;
    }

    private ClaimsPrincipal StripAdminRole(ClaimsPrincipal principal, string warningReason)
    {
        _logger.LogWarning("[SECURITY ALERT] {Reason}", warningReason);

        if (principal.Identity is ClaimsIdentity identity)
        {
            var adminClaims = identity.FindAll(c =>
                (c.Type == ClaimTypes.Role || c.Type == "role") &&
                string.Equals(c.Value, "Admin", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var claim in adminClaims)
            {
                identity.RemoveClaim(claim);
            }
        }

        return principal;
    }
}
