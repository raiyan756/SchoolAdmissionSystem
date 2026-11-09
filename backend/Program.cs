using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls(builder.Configuration["urls"] ?? "http://localhost:8080");
builder.Services.AddControllers();
var connectionString = builder.Configuration.GetConnectionString("AdmissionDb")
    ?? throw new InvalidOperationException("Set ConnectionStrings__AdmissionDb to a PostgreSQL connection string.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

var app = builder.Build();

// Compose waits for PostgreSQL; apply versioned schema changes before accepting requests.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
