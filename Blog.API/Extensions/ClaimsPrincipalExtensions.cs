using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace Blog.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserIdStr(this ClaimsPrincipal user)
    {
        if (user == null) return null;

        return user.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? user.FindFirst("sub")?.Value 
            ?? user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
    }

    public static Guid? GetUserId(this ClaimsPrincipal user)
    {
        var idStr = user.GetUserIdStr();
        if (Guid.TryParse(idStr, out var id))
        {
            return id;
        }
        return null;
    }
}
