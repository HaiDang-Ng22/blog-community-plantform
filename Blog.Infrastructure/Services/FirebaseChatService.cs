using Blog.Domain.Entities;
using Blog.Domain.Interfaces;
using Google.Cloud.Firestore;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Blog.Infrastructure.Services;

public class FirebaseChatService : IFirebaseChatService
{
    private readonly FirestoreDb _db;
    private readonly ILogger<FirebaseChatService> _logger;
    private const string CollectionName = "conversations";

    public FirebaseChatService(IConfiguration configuration, ILogger<FirebaseChatService> logger)
    {
        _logger = logger;
        try 
        {
            string projectId = configuration["Firebase:ProjectId"] ?? "messages-1f262";
            _db = FirestoreDb.Create(projectId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize FirestoreDb");
            throw;
        }
    }

    public async Task<string> SaveMessageAsync(Message message)
    {
        try 
        {
            var docRef = _db.Collection(CollectionName)
                            .Document(message.ConversationId.ToString())
                            .Collection("messages")
                            .Document(message.Id.ToString());

            var data = new Dictionary<string, object>
            {
                { "id", message.Id.ToString() },
                { "senderId", message.SenderId.ToString() },
                { "content", message.Content },
                { "imageUrl", message.ImageUrl ?? "" },
                { "isRead", message.IsRead },
                { "createdAt", Timestamp.FromDateTime(message.CreatedAt.ToUniversalTime()) },
                { "replyToMessageId", message.ReplyToMessageId?.ToString() ?? "" },
                { "isHearted", message.IsHearted },
                { "sharedPostId", message.SharedPostId?.ToString() ?? "" }
            };

            await docRef.SetAsync(data);
            return message.Id.ToString();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Firebase Error] SaveMessageAsync: {ex.Message}");
            throw;
        }
    }

    public async Task<Message?> GetMessageByIdAsync(Guid conversationId, Guid messageId)
    {
        try 
        {
            var docRef = _db.Collection(CollectionName)
                            .Document(conversationId.ToString())
                            .Collection("messages")
                            .Document(messageId.ToString());

            var snapshot = await docRef.GetSnapshotAsync();
            if (!snapshot.Exists) return null;

            var data = snapshot.ToDictionary();
            return new Message
            {
                Id = Guid.Parse(data["id"].ToString()!),
                ConversationId = conversationId,
                SenderId = Guid.Parse(data["senderId"].ToString()!),
                Content = data["content"].ToString()!,
                ImageUrl = data.ContainsKey("imageUrl") ? data["imageUrl"].ToString() : null,
                IsRead = (bool)data["isRead"],
                CreatedAt = ((Timestamp)data["createdAt"]).ToDateTime(),
                IsHearted = data.ContainsKey("isHearted") ? (bool)data["isHearted"] : false,
                ReplyToMessageId = data.ContainsKey("replyToMessageId") && !string.IsNullOrEmpty(data["replyToMessageId"].ToString()) 
                                   ? Guid.Parse(data["replyToMessageId"].ToString()!) : null,
                SharedPostId = data.ContainsKey("sharedPostId") && !string.IsNullOrEmpty(data["sharedPostId"].ToString())
                               ? Guid.Parse(data["sharedPostId"].ToString()!) : null
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Firebase Error] GetMessageByIdAsync: {ex.Message}");
            return null;
        }
    }

    public async Task<List<Message>> GetMessagesAsync(Guid conversationId, int limit = 50, DateTime? before = null)
    {
        try 
        {
            var messagesRef = _db.Collection(CollectionName)
                                 .Document(conversationId.ToString())
                                 .Collection("messages");

            Query query = messagesRef.OrderByDescending("createdAt").Limit(limit);

            if (before.HasValue)
            {
                query = query.StartAfter(Timestamp.FromDateTime(before.Value.ToUniversalTime()));
            }

            var snapshot = await query.GetSnapshotAsync();
            var messages = new List<Message>();

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                messages.Add(new Message
                {
                    Id = Guid.Parse(data["id"].ToString()!),
                    ConversationId = conversationId,
                    SenderId = Guid.Parse(data["senderId"].ToString()!),
                    Content = data["content"].ToString()!,
                    ImageUrl = data.ContainsKey("imageUrl") ? data["imageUrl"].ToString() : null,
                    IsRead = (bool)data["isRead"],
                    CreatedAt = ((Timestamp)data["createdAt"]).ToDateTime(),
                    IsHearted = data.ContainsKey("isHearted") ? (bool)data["isHearted"] : false,
                    ReplyToMessageId = data.ContainsKey("replyToMessageId") && !string.IsNullOrEmpty(data["replyToMessageId"].ToString()) 
                                       ? Guid.Parse(data["replyToMessageId"].ToString()!) : null,
                    SharedPostId = data.ContainsKey("sharedPostId") && !string.IsNullOrEmpty(data["sharedPostId"].ToString())
                                   ? Guid.Parse(data["sharedPostId"].ToString()!) : null
                });
            }

            return messages.OrderBy(m => m.CreatedAt).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting messages from Firebase for conversation {ConversationId}", conversationId);
            throw;
        }
    }

    public async Task MarkAsReadAsync(Guid conversationId, Guid userId)
    {
        try 
        {
            var messagesRef = _db.Collection(CollectionName)
                                 .Document(conversationId.ToString())
                                 .Collection("messages");

            // Find unread messages where sender is NOT the current user
            var query = messagesRef.WhereEqualTo("isRead", false)
                                   .WhereNotEqualTo("senderId", userId.ToString());

            var snapshot = await query.GetSnapshotAsync();
            var batch = _db.StartBatch();

            foreach (var doc in snapshot.Documents)
            {
                batch.Update(doc.Reference, new Dictionary<string, object> { { "isRead", true } });
            }

            await batch.CommitAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Firebase Error] MarkAsReadAsync: {ex.Message}");
        }
    }

    public async Task UpdateMessageHeartAsync(Guid conversationId, Guid messageId, bool isHearted)
    {
        try 
        {
            var docRef = _db.Collection(CollectionName)
                            .Document(conversationId.ToString())
                            .Collection("messages")
                            .Document(messageId.ToString());

            await docRef.UpdateAsync(new Dictionary<string, object> { { "isHearted", isHearted } });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Firebase Error] UpdateMessageHeartAsync: {ex.Message}");
        }
    }

    public async Task<int> GetUnreadCountAsync(Guid conversationId, Guid userId)
    {
        try 
        {
            var messagesRef = _db.Collection(CollectionName)
                                 .Document(conversationId.ToString())
                                 .Collection("messages");

            var query = messagesRef.WhereEqualTo("isRead", false)
                                   .WhereNotEqualTo("senderId", userId.ToString());

            var snapshot = await query.GetSnapshotAsync();
            return snapshot.Count;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Firebase Error] GetUnreadCountAsync: {ex.Message}");
            return 0;
        }
    }
}
