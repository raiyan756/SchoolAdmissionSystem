using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Npgsql;
using Xunit;

namespace SchoolAdmission.Api.Tests;

// Each test owns its classes. The Compose test stack has an isolated, temporary PostgreSQL database.
public class AdmissionApiTests : IAsyncLifetime
{
    private const string Student = "00123456789012345";
    private const string OtherStudent = "00123456789012346";
    private readonly List<Guid> createdClasses = [];
    private readonly HttpClient client = new()
    {
        BaseAddress = new Uri(Environment.GetEnvironmentVariable("API_BASE_URL") ?? "http://localhost:8080"),
        Timeout = TimeSpan.FromSeconds(30)
    };
    private readonly string connectionString = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
        ?? throw new InvalidOperationException("Run with docker-compose.test.yml or set TEST_DB_CONNECTION to an isolated test database.");

    public async Task InitializeAsync()
    {
        Assert.Equal("admission_tests", new NpgsqlConnectionStringBuilder(connectionString).Database);
        var timeout = Stopwatch.StartNew();
        while (timeout.Elapsed < TimeSpan.FromSeconds(30))
        {
            try
            {
                using var response = await client.GetAsync("/health");
                if (response.IsSuccessStatusCode) return;
            }
            catch (HttpRequestException) { }
            await Task.Delay(200);
        }
        throw new TimeoutException("The test backend did not become ready within 30 seconds.");
    }

    public async Task DisposeAsync()
    {
        try
        {
            if (createdClasses.Count > 0)
            {
                await using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();
                await using var transaction = await connection.BeginTransactionAsync();
                await using var command = new NpgsqlCommand("""
                    SELECT "Id" FROM "Classes" WHERE "Id" = ANY(@ids) ORDER BY "Id" FOR UPDATE;
                    DELETE FROM "Holds" WHERE "ClassId" = ANY(@ids);
                    DELETE FROM "Classes" WHERE "Id" = ANY(@ids);
                    """, connection, transaction);
                command.Parameters.AddWithValue("ids", createdClasses.ToArray());
                await command.ExecuteNonQueryAsync();
                await transaction.CommitAsync();
            }
        }
        finally { client.Dispose(); }
    }

    [Fact]
    public async Task Create_class_returns_location_and_consistent_list_and_detail()
    {
        var id = await CreateClassAsync(7);
        var detail = await SendAsync(HttpMethod.Get, $"/classes/{id}");
        Assert.Equal(HttpStatusCode.OK, detail.Status);
        Assert.Equal("Integration test", detail.Body.GetProperty("name").GetString());
        AssertSeats(detail.Body, 0, 0, 7);
        var list = await SendAsync(HttpMethod.Get, "/classes");
        Assert.Equal(HttpStatusCode.OK, list.Status);
        var row = Assert.Single(list.Body.EnumerateArray(), x => x.GetProperty("id").GetGuid() == id);
        AssertSeats(row, 0, 0, 7);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"name\":\"   \",\"totalSeats\":1}")]
    [InlineData("{\"name\":null,\"totalSeats\":1}")]
    [InlineData("{\"name\":\"Invalid\",\"totalSeats\":0}")]
    [InlineData("{\"name\":\"Invalid\",\"totalSeats\":-1}")]
    [InlineData("{\"name\":\"Invalid\",\"totalSeats\":1.5}")]
    [InlineData("{ malformed json")]
    public async Task Invalid_class_input_returns_validation_problem(string json)
    {
        using var response = await client.PostAsync("/classes", new StringContent(json, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(400, problem.GetProperty("status").GetInt32());
        Assert.True(problem.TryGetProperty("errors", out _));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("123456789012345678")]
    [InlineData("a0123456789012345")]
    public async Task Invalid_student_cannot_create_hold(string? student)
    {
        var id = await CreateClassAsync(1);
        var response = await SendAsync(HttpMethod.Post, $"/classes/{id}/holds", student);
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        AssertSeats((await SendAsync(HttpMethod.Get, $"/classes/{id}")).Body, 0, 0, 1);
    }

    [Fact]
    public async Task Concurrent_distinct_students_never_exceed_capacity()
    {
        const int seats = 7;
        var id = await CreateClassAsync(seats);
        var results = await RaceAsync(60, i => SendAsync(HttpMethod.Post, $"/classes/{id}/holds", (i + 1).ToString("D17")));
        Assert.Equal(seats, results.Count(x => x.Status == HttpStatusCode.Created));
        Assert.Equal(60 - seats, results.Count(x => x.Status == HttpStatusCode.Conflict));
        Assert.Equal(seats, await ScalarAsync<long>("SELECT count(*) FROM \"Holds\" WHERE \"ClassId\" = @id", id));
        AssertSeats((await SendAsync(HttpMethod.Get, $"/classes/{id}")).Body, seats, 0, 0);
    }

    [Fact]
    public async Task Concurrent_same_student_gets_only_one_active_hold()
    {
        var id = await CreateClassAsync(20);
        var results = await RaceAsync(30, _ => SendAsync(HttpMethod.Post, $"/classes/{id}/holds", Student));
        var created = Assert.Single(results, x => x.Status == HttpStatusCode.Created);
        Assert.Equal(Student, created.Body.GetProperty("studentId").GetString());
        Assert.Equal("HELD", created.Body.GetProperty("status").GetString());
        Assert.Equal(id, created.Body.GetProperty("classId").GetGuid());
        Assert.Equal(29, results.Count(x => x.Status == HttpStatusCode.Conflict));
        Assert.Equal(1L, await ScalarAsync<long>("SELECT count(*) FROM \"Holds\" WHERE \"ClassId\" = @id", id));
    }

    [Fact]
    public async Task Concurrent_confirmation_is_idempotent_and_counts_one_admission()
    {
        var classId = await CreateClassAsync(1);
        var holdId = await CreateHoldAsync(classId);
        var results = await RaceAsync(24, _ => SendAsync(HttpMethod.Post, $"/holds/{holdId}/confirm", Student));
        Assert.All(results, result =>
        {
            Assert.Equal(HttpStatusCode.OK, result.Status);
            Assert.Equal(holdId, result.Body.GetProperty("holdId").GetGuid());
            Assert.Equal("CONFIRMED", result.Body.GetProperty("status").GetString());
        });
        AssertSeats((await SendAsync(HttpMethod.Get, $"/classes/{classId}")).Body, 0, 1, 0);
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(HttpMethod.Post, $"/classes/{classId}/holds", Student)).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(HttpMethod.Delete, $"/holds/{holdId}", Student)).Status);
    }

    [Fact]
    public async Task Cancellation_is_idempotent_preserves_history_and_releases_seat()
    {
        var classId = await CreateClassAsync(1);
        var holdId = await CreateHoldAsync(classId);
        var results = await RaceAsync(24, _ => SendAsync(HttpMethod.Delete, $"/holds/{holdId}", Student));
        Assert.All(results, x => Assert.Equal(HttpStatusCode.NoContent, x.Status));
        Assert.Equal("CANCELLED", (await SendAsync(HttpMethod.Get, $"/holds/{holdId}")).Body.GetProperty("status").GetString());
        AssertSeats((await SendAsync(HttpMethod.Get, $"/classes/{classId}")).Body, 0, 0, 1);
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(HttpMethod.Post, $"/holds/{holdId}/confirm", Student)).Status);
        Assert.NotEqual(holdId, await CreateHoldAsync(classId));
    }

    [Fact]
    public async Task Another_student_cannot_change_hold_or_see_it_in_their_history()
    {
        var classId = await CreateClassAsync(2);
        var holdId = await CreateHoldAsync(classId);
        var otherHold = await CreateHoldAsync(classId, OtherStudent);
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(HttpMethod.Post, $"/holds/{holdId}/confirm", OtherStudent)).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(HttpMethod.Delete, $"/holds/{holdId}", OtherStudent)).Status);
        var mine = await SendAsync(HttpMethod.Get, "/me/holds", Student);
        Assert.Equal(HttpStatusCode.OK, mine.Status);
        var row = Assert.Single(mine.Body.EnumerateArray());
        Assert.Equal(holdId, row.GetProperty("holdId").GetGuid());
        Assert.NotEqual(otherHold, row.GetProperty("holdId").GetGuid());
        Assert.Equal("Integration test", row.GetProperty("className").GetString());
        Assert.Equal("HELD", row.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(HttpMethod.Get, "/me/holds")).Status);
    }

    [Fact]
    public async Task Unknown_and_malformed_ids_return_404_and_400()
    {
        foreach (var (id, expected) in new[] { (Guid.NewGuid().ToString(), HttpStatusCode.NotFound), ("not-a-guid", HttpStatusCode.BadRequest) })
        {
            Assert.Equal(expected, (await SendAsync(HttpMethod.Get, $"/classes/{id}")).Status);
            Assert.Equal(expected, (await SendAsync(HttpMethod.Post, $"/classes/{id}/holds", Student)).Status);
            Assert.Equal(expected, (await SendAsync(HttpMethod.Get, $"/holds/{id}")).Status);
            Assert.Equal(expected, (await SendAsync(HttpMethod.Post, $"/holds/{id}/confirm", Student)).Status);
            Assert.Equal(expected, (await SendAsync(HttpMethod.Delete, $"/holds/{id}", Student)).Status);
        }
    }

    [Fact]
    public async Task Confirm_cancel_race_has_one_consistent_final_state()
    {
        var classId = await CreateClassAsync(1);
        var holdId = await CreateHoldAsync(classId);
        var results = await RaceAsync(30, i => i % 2 == 0
            ? SendAsync(HttpMethod.Post, $"/holds/{holdId}/confirm", Student)
            : SendAsync(HttpMethod.Delete, $"/holds/{holdId}", Student));
        var state = (await SendAsync(HttpMethod.Get, $"/holds/{holdId}")).Body.GetProperty("status").GetString();
        Assert.Contains(state, new[] { "CONFIRMED", "CANCELLED" });
        for (var i = 0; i < results.Length; i++)
            Assert.Equal(i % 2 == 0
                ? (state == "CONFIRMED" ? HttpStatusCode.OK : HttpStatusCode.Conflict)
                : (state == "CANCELLED" ? HttpStatusCode.NoContent : HttpStatusCode.Conflict), results[i].Status);
        AssertSeats((await SendAsync(HttpMethod.Get, $"/classes/{classId}")).Body, 0, state == "CONFIRMED" ? 1 : 0, state == "CANCELLED" ? 1 : 0);
    }

    [Fact]
    public async Task Worker_expires_hold_without_HTTP_requests_but_preserves_confirmed_admission()
    {
        var classId = await CreateClassAsync(2);
        var expiredId = await CreateHoldAsync(classId);
        var confirmedId = await CreateHoldAsync(classId, OtherStudent);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(HttpMethod.Post, $"/holds/{confirmedId}/confirm", OtherStudent)).Status);
        Assert.Equal(600m, await ScalarAsync<decimal>("SELECT EXTRACT(EPOCH FROM (\"ExpiresAt\" - \"CreatedAt\")) FROM \"Holds\" WHERE \"Id\" = @id", expiredId));
        // Shorten only these test records; the real worker and PostgreSQL still perform expiry.
        await ScalarAsync<long>("""
            WITH changed AS (UPDATE "Holds" SET "ExpiresAt" = clock_timestamp() + interval '1 second'
                WHERE "ClassId" = @id RETURNING 1) SELECT count(*) FROM changed
            """, classId);
        var timeout = Stopwatch.StartNew();
        while (await ScalarAsync<string>("SELECT \"Status\" FROM \"Holds\" WHERE \"Id\" = @id", expiredId) != "EXPIRED")
        {
            Assert.True(timeout.Elapsed < TimeSpan.FromSeconds(15), "Worker did not persist expiry without API calls.");
            await Task.Delay(100);
        }
        Assert.Equal("CONFIRMED", await ScalarAsync<string>("SELECT \"Status\" FROM \"Holds\" WHERE \"Id\" = @id", confirmedId));
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(HttpMethod.Post, $"/holds/{expiredId}/confirm", Student)).Status);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(HttpMethod.Post, $"/holds/{confirmedId}/confirm", OtherStudent)).Status);
        AssertSeats((await SendAsync(HttpMethod.Get, $"/classes/{classId}")).Body, 0, 1, 1);
        Assert.NotEqual(expiredId, await CreateHoldAsync(classId));
    }

    private async Task<Guid> CreateClassAsync(int seats)
    {
        using var response = await client.PostAsJsonAsync("/classes", new { name = "  Integration test  ", totalSeats = seats });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var id = body.GetProperty("id").GetGuid();
        createdClasses.Add(id);
        Assert.Equal(seats, body.GetProperty("totalSeats").GetInt32());
        Assert.Equal($"/classes/{id}", response.Headers.Location?.AbsolutePath);
        return id;
    }

    private async Task<Guid> CreateHoldAsync(Guid classId, string student = Student)
    {
        var response = await SendAsync(HttpMethod.Post, $"/classes/{classId}/holds", student);
        Assert.Equal(HttpStatusCode.Created, response.Status);
        Assert.True(response.Body.GetProperty("expiresAt").GetDateTimeOffset() > DateTimeOffset.UtcNow);
        return response.Body.GetProperty("holdId").GetGuid();
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> SendAsync(HttpMethod method, string path, string? student = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (student is not null) request.Headers.TryAddWithoutValidation("X-Student-Id", student);
        using var response = await client.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, string.IsNullOrEmpty(json) ? default : JsonSerializer.Deserialize<JsonElement>(json));
    }

    private static async Task<T[]> RaceAsync<T>(int count, Func<int, Task<T>> action)
    {
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, count).Select(async i => { await start.Task; return await action(i); }).ToArray();
        start.SetResult();
        return await Task.WhenAll(tasks);
    }

    private async Task<T> ScalarAsync<T>(string sql, Guid id)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        return (T)(await command.ExecuteScalarAsync() ?? throw new InvalidOperationException("Missing database result."));
    }

    private static void AssertSeats(JsonElement body, int held, int confirmed, int available)
    {
        Assert.Equal(held, body.GetProperty("heldSeats").GetInt32());
        Assert.Equal(confirmed, body.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(available, body.GetProperty("availableSeats").GetInt32());
        Assert.Equal(held + confirmed + available, body.GetProperty("totalSeats").GetInt32());
    }
}
