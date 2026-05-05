using System.ComponentModel.DataAnnotations;

namespace Blog.Application.DTOs
{
    public class PushSubscriptionDto
    {
        [Required]
        public string Endpoint { get; set; } = string.Empty;

        [Required]
        public string P256dh { get; set; } = string.Empty;

        [Required]
        public string Auth { get; set; } = string.Empty;
    }
}
