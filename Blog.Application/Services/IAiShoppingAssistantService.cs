using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blog.Application.Dtos.AiChat;

namespace Blog.Application.Services;

public interface IAiShoppingAssistantService
{
    Task<AiChatSessionDto> CreateSessionAsync(Guid? userId, string? anonymousSessionId, CancellationToken cancellationToken);
    Task<List<AiChatSessionDto>> GetUserSessionsAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken);
    Task<List<AiChatMessageDto>> GetSessionMessagesAsync(Guid sessionId, Guid? userId, string? anonymousSessionId, CancellationToken cancellationToken);
    Task<bool> DeleteSessionAsync(Guid sessionId, Guid? userId, string? anonymousSessionId, CancellationToken cancellationToken);
    Task<AiChatResponseDto> SendMessageAsync(Guid? userId, AiChatRequestDto request, CancellationToken cancellationToken);
    Task<bool> TrackClickAsync(Guid recommendationLogId, Guid? userId, CancellationToken cancellationToken);
    Task<bool> TrackAddToCartAsync(Guid recommendationLogId, Guid? userId, CancellationToken cancellationToken);
}
