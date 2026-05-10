using Blog.Domain.Entities;

namespace Blog.Domain.Interfaces;

public interface IFirebaseChatService
{
    Task<string> SaveMessageAsync(Message message);
    Task<Message?> GetMessageByIdAsync(Guid conversationId, Guid messageId);
    Task<List<Message>> GetMessagesAsync(Guid conversationId, int limit = 50, DateTime? before = null);
    Task MarkAsReadAsync(Guid conversationId, Guid userId);
    Task UpdateMessageHeartAsync(Guid conversationId, Guid messageId, bool isHearted);
    Task<int> GetUnreadCountAsync(Guid conversationId, Guid userId);
}
