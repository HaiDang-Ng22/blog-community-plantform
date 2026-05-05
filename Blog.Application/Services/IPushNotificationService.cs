using System;
using System.Threading.Tasks;

namespace Blog.Application.Services
{
    public interface IPushNotificationService
    {
        Task SendPushNotificationAsync(Guid userId, string title, string message, string url = "/");
    }
}
