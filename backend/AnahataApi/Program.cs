using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddHttpClient();

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("frontend");

app.MapPost("/api/chat", async (ChatRequest request, IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<Program> logger) =>
{
    var safeName = string.IsNullOrWhiteSpace(request.UserName) ? "there" : request.UserName.Trim();
    var message = request.Message?.Trim() ?? string.Empty;

    if (string.IsNullOrWhiteSpace(message))
    {
        return Results.Ok(new ChatResponse($"Hi {safeName}, I am here with you. Share what is on your mind."));
    }

    var apiKey = config["Llm:ApiKey"];
    var baseUrl = config["Llm:BaseUrl"];
    var model = config["Llm:Model"];

    if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(model))
    {
        return Results.BadRequest(new ChatResponse("LLM configuration is missing. Set Llm:ApiKey, Llm:BaseUrl, and Llm:Model."));
    }

    try
    {
        var client = httpClientFactory.CreateClient();
        using var httpRequest = BuildProviderRequest(request, safeName, message, apiKey, baseUrl, model);
        var requestUrl = httpRequest.RequestUri?.ToString() ?? "(null)";

        using var response = await client.SendAsync(httpRequest);
        var raw = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            var hint = raw.Length > 260 ? raw[..260] + "..." : raw;
            logger.LogError("LLM provider error {StatusCode} for {RequestUrl}. Body: {Body}", (int)response.StatusCode, SanitizeUrl(requestUrl), raw);

            if ((int)response.StatusCode == 429)
            {
                var retryIn = ExtractRetryDelay(raw);
                var retryText = string.IsNullOrWhiteSpace(retryIn) ? "Please retry later." : $"Please retry in about {retryIn}.";
                return Results.BadRequest(new ChatResponse($"LLM quota/rate limit reached (429). {retryText}"));
            }

            return Results.BadRequest(new ChatResponse($"LLM request failed: {(int)response.StatusCode}. {hint}"));
        }

        var reply = ExtractReplyText(raw);
        if (string.IsNullOrWhiteSpace(reply))
        {
            return Results.BadRequest(new ChatResponse("LLM response parsed but no assistant text found. Verify provider response format."));
        }

        return Results.Ok(new ChatResponse(reply));
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new ChatResponse($"Chat integration error: {ex.Message}"));
    }
});

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

static HttpRequestMessage BuildProviderRequest(
    ChatRequest request,
    string safeName,
    string message,
    string apiKey,
    string baseUrl,
    string model)
{
    var isGemini = baseUrl.Contains("generativelanguage.googleapis.com", StringComparison.OrdinalIgnoreCase);
    var systemPrompt = "You are a calm, supportive wellness assistant. Be concise, kind, and non-judgmental.";

    if (isGemini)
    {
        var endpoint = BuildGeminiEndpoint(baseUrl, model, apiKey);

        var contents = request.History?
            .Where(h => !string.IsNullOrWhiteSpace(h.Content))
            .Select(h => (object)new
            {
                role = h.Role is "assistant" ? "model" : "user",
                parts = new[] { new { text = h.Content } }
            })
            .ToList() ?? new List<object>();

        contents.Add(new
        {
            role = "user",
            parts = new[] { new { text = message } }
        });

        var payload = new
        {
            systemInstruction = new
            {
                parts = new[]
                {
                    new { text = systemPrompt },
                    new { text = $"User name: {safeName}. Mood score: {request.MoodScore}/25." }
                }
            },
            contents,
            generationConfig = new
            {
                temperature = 0.7
            }
        };

        return new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
    }

    var history = request.History?
        .Where(h => !string.IsNullOrWhiteSpace(h.Content))
        .Select(h => (object)new
        {
            role = h.Role is "assistant" ? "assistant" : "user",
            content = h.Content
        })
        .ToList() ?? new List<object>();

    var openAiPayload = new
    {
        model,
        messages = new List<object>
        {
            new { role = "system", content = systemPrompt },
            new { role = "system", content = $"User name: {safeName}. Mood score: {request.MoodScore}/25." }
        }
        .Concat(history)
        .Concat(new[] { new { role = "user", content = message } })
        .ToList(),
        temperature = 0.7
    };

    var openAiRequest = new HttpRequestMessage(HttpMethod.Post, baseUrl)
    {
        Content = new StringContent(JsonSerializer.Serialize(openAiPayload), Encoding.UTF8, "application/json")
    };
    openAiRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
    return openAiRequest;
}

static string BuildGeminiEndpoint(string baseUrl, string model, string apiKey)
{
    var trimmed = baseUrl.TrimEnd('/');
    var escapedKey = Uri.EscapeDataString(apiKey);

    if (trimmed.Contains(":generateContent", StringComparison.OrdinalIgnoreCase))
    {
        var separator = trimmed.Contains('?') ? "&" : "?";
        return $"{trimmed}{separator}key={escapedKey}";
    }

    return $"{trimmed}/v1beta/models/{model}:generateContent?key={escapedKey}";
}

static string SanitizeUrl(string url)
{
    if (string.IsNullOrWhiteSpace(url))
    {
        return url;
    }

    return url.Replace("key=", "key=***", StringComparison.OrdinalIgnoreCase);
}

static string ExtractRetryDelay(string rawJson)
{
    try
    {
        using var doc = JsonDocument.Parse(rawJson);
        var root = doc.RootElement;
        if (root.TryGetProperty("error", out var error) &&
            error.TryGetProperty("details", out var details) &&
            details.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in details.EnumerateArray())
            {
                if (item.TryGetProperty("@type", out var typeProp) &&
                    typeProp.GetString() == "type.googleapis.com/google.rpc.RetryInfo" &&
                    item.TryGetProperty("retryDelay", out var retryDelay))
                {
                    return retryDelay.GetString() ?? string.Empty;
                }
            }
        }
    }
    catch
    {
        return string.Empty;
    }

    return string.Empty;
}

static string ExtractReplyText(string rawJson)
{
    using var doc = JsonDocument.Parse(rawJson);
    var root = doc.RootElement;

    if (root.TryGetProperty("choices", out var choices) &&
        choices.ValueKind == JsonValueKind.Array &&
        choices.GetArrayLength() > 0)
    {
        var first = choices[0];

        if (first.TryGetProperty("message", out var message) &&
            message.TryGetProperty("content", out var contentElement))
        {
            if (contentElement.ValueKind == JsonValueKind.String)
            {
                var content = contentElement.GetString();
                if (!string.IsNullOrWhiteSpace(content))
                {
                    return content;
                }
            }

            if (contentElement.ValueKind == JsonValueKind.Array)
            {
                var contentParts = contentElement.EnumerateArray()
                    .Where(p => p.ValueKind == JsonValueKind.Object && p.TryGetProperty("text", out _))
                    .Select(p => p.GetProperty("text").GetString())
                    .Where(t => !string.IsNullOrWhiteSpace(t));

                var joinedContent = string.Join("\n", contentParts!);
                if (!string.IsNullOrWhiteSpace(joinedContent))
                {
                    return joinedContent;
                }
            }
        }

        if (first.TryGetProperty("text", out var textElement))
        {
            var text = textElement.GetString();
            if (!string.IsNullOrWhiteSpace(text))
            {
                return text;
            }
        }
    }

    if (root.TryGetProperty("candidates", out var candidates) &&
        candidates.ValueKind == JsonValueKind.Array &&
        candidates.GetArrayLength() > 0)
    {
        var firstCandidate = candidates[0];
        if (firstCandidate.TryGetProperty("content", out var geminiContent) &&
            geminiContent.TryGetProperty("parts", out var parts) &&
            parts.ValueKind == JsonValueKind.Array)
        {
            var texts = parts.EnumerateArray()
                .Where(p => p.TryGetProperty("text", out _))
                .Select(p => p.GetProperty("text").GetString())
                .Where(t => !string.IsNullOrWhiteSpace(t));

            var joined = string.Join("\n", texts!);
            if (!string.IsNullOrWhiteSpace(joined))
            {
                return joined;
            }
        }
    }

    // Last-resort fallback for providers that nest text differently.
    var deepTexts = new List<string>();
    CollectTextValues(root, deepTexts);
    var deepJoined = string.Join("\n", deepTexts.Where(t => !string.IsNullOrWhiteSpace(t)));
    if (!string.IsNullOrWhiteSpace(deepJoined))
    {
        return deepJoined;
    }

    if (root.TryGetProperty("output_text", out var outputTextElement))
    {
        var outputText = outputTextElement.GetString();
        if (!string.IsNullOrWhiteSpace(outputText))
        {
            return outputText;
        }
    }

    return string.Empty;
}

static void CollectTextValues(JsonElement element, List<string> output)
{
    switch (element.ValueKind)
    {
        case JsonValueKind.Object:
            foreach (var prop in element.EnumerateObject())
            {
                if (prop.NameEquals("text") && prop.Value.ValueKind == JsonValueKind.String)
                {
                    var value = prop.Value.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        output.Add(value);
                    }
                }
                else
                {
                    CollectTextValues(prop.Value, output);
                }
            }
            break;

        case JsonValueKind.Array:
            foreach (var item in element.EnumerateArray())
            {
                CollectTextValues(item, output);
            }
            break;
    }
}

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

record ChatRequest(string UserName, int MoodScore, string Message, IEnumerable<ChatMessage>? History);
record ChatMessage(string Role, string Content, string Timestamp);
record ChatResponse(string Reply);
