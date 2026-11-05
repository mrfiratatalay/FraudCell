using System.Net;
using System.Text.Json;
using FraudCell.BuildingBlocks.Correlation;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FraudCell.BuildingBlocks.Api;

/// <summary>
/// Tek hata cikis noktasi. Her hata dokuman §19'daki zarf formatinda doner ve
/// <c>meta.traceId</c> tasir (API-013).
///
/// Beklenmeyen hatalarda istemciye stack trace veya exception mesaji SIZDIRILMAZ;
/// detay yalnizca sunucu logunda kalir.
/// </summary>
public sealed partial class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger,
    JsonSerializerOptions jsonOptions)
{
    public async Task InvokeAsync(HttpContext context, CorrelationContext correlation)
    {
        try
        {
            await next(context);
        }
        catch (AppException ex)
        {
            // Beklenen domain/uygulama hatasi: Warning seviyesinde, stack trace'siz.
            LogHandledApplicationError(logger, ex.Code, context.Request.Method, context.Request.Path, ex.Message);

            await WriteAsync(context, ex.StatusCode, new ApiError(ex.Code, ex.Message, ex.Details), correlation);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            // Optimistic concurrency: iki analist ayni vakaya ayni anda karar verdi (CASE-013).
            LogConcurrencyConflict(logger, ex, context.Request.Method, context.Request.Path);

            await WriteAsync(
                context,
                HttpStatusCode.Conflict,
                new ApiError(
                    ErrorCodes.ConcurrencyConflict,
                    "Kayıt siz işlem yaparken başkası tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin."),
                correlation);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Istemci baglantiyi kapatti; bu bir hata degil, loglamaya deger bilgi degil.
            LogRequestAborted(logger, context.Request.Method, context.Request.Path);
        }
        catch (Exception ex)
        {
            LogUnhandledException(logger, ex, context.Request.Method, context.Request.Path);

            await WriteAsync(
                context,
                HttpStatusCode.InternalServerError,
                new ApiError(ErrorCodes.InternalError, "Beklenmeyen bir hata olustu."),
                correlation);
        }
    }

    private async Task WriteAsync(
        HttpContext context,
        HttpStatusCode status,
        ApiError error,
        CorrelationContext correlation)
    {
        if (context.Response.HasStarted)
        {
            // Cevap govdesi akmaya baslamis (ornegin SSE); zarf yazamayiz.
            LogResponseAlreadyStarted(logger, error.Code);
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json; charset=utf-8";

        var payload = ApiResponse.Failure(error, correlation.CorrelationId);
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, jsonOptions), context.RequestAborted);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Handled application error {ErrorCode} on {Method} {Path}: {ErrorMessage}")]
    private static partial void LogHandledApplicationError(ILogger logger, string errorCode, string method, PathString path, string errorMessage);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Concurrency conflict on {Method} {Path}")]
    private static partial void LogConcurrencyConflict(ILogger logger, Exception exception, string method, PathString path);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Request aborted by client: {Method} {Path}")]
    private static partial void LogRequestAborted(ILogger logger, string method, PathString path);

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception on {Method} {Path}")]
    private static partial void LogUnhandledException(ILogger logger, Exception exception, string method, PathString path);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Response already started; cannot write error envelope for {ErrorCode}")]
    private static partial void LogResponseAlreadyStarted(ILogger logger, string errorCode);
}
