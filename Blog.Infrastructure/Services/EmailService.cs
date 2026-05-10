using System.Net;
using System.Net.Mail;
using Blog.Domain.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Blog.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        var smtpSettings = _configuration.GetSection("EmailSettings");
        
        using var client = new SmtpClient(smtpSettings["SmtpServer"], int.Parse(smtpSettings["Port"] ?? "587"))
        {
            Credentials = new NetworkCredential(smtpSettings["Username"], smtpSettings["Password"]),
            EnableSsl = true
        };

        var mailMessage = new MailMessage
        {
            From = new MailAddress(smtpSettings["SenderEmail"]!, smtpSettings["SenderName"]),
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };

        mailMessage.To.Add(toEmail);

        await client.SendMailAsync(mailMessage);
    }
}
