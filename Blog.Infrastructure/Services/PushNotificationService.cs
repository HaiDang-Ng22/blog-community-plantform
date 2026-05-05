using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blog.Application.Services;
using Blog.Domain.Entities;
using Blog.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using WebPush;

namespace Blog.Infrastructure.Services
{
    public class PushNotificationService : IPushNotificationService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public PushNotificationService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task SendPushNotificationAsync(Guid userId, string title, string message, string url = "/")
        {
            var subscriptions = await _context.PushSubscriptions
                .Where(s => s.UserId == userId)
                .ToListAsync();

            if (!subscriptions.Any()) return;

            var subject = _config["VapidDetails:Subject"];
            var publicKey = _config["VapidDetails:PublicKey"];
            var privateKey = _config["VapidDetails:PrivateKey"];

            if (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(publicKey) || string.IsNullOrEmpty(privateKey))
                return;

            var vapidDetails = new VapidDetails(subject, publicKey, privateKey);
            var webPushClient = new WebPushClient();

            var payload = JsonConvert.SerializeObject(new
            {
                title = title,
                message = message,
                url = url
            });

            var tasks = new List<Task>();

            foreach (var sub in subscriptions)
            {
                var pushSubscription = new WebPush.PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                try
                {
                    // Send asynchronously
                    tasks.Add(webPushClient.SendNotificationAsync(pushSubscription, payload, vapidDetails));
                }
                catch (WebPushException exception)
                {
                    if (exception.StatusCode == System.Net.HttpStatusCode.Gone || exception.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        // The endpoint is no longer valid
                        _context.PushSubscriptions.Remove(sub);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Push Notification Error: {ex.Message}");
                }
            }

            await Task.WhenAll(tasks.Select(t => t.ContinueWith(tsk => {
                if (tsk.IsFaulted)
                {
                    // Handle faults here (e.g., if a sub fails, we could remove it if it's a 404/410)
                }
            })));
            
            await _context.SaveChangesAsync();
        }
    }
}
