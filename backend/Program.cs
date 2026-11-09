using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Repositories;
using SchoolAdmission.Api.Repositories.Interfaces;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls(builder.Configuration["urls"] ?? "http://localhost:8080");
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
var connectionString = builder.Configuration.GetConnectionString("AdmissionDb")
    ?? throw new InvalidOperationException("Set ConnectionStrings__AdmissionDb to a PostgreSQL connection string.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<IClassRepository, ClassRepository>();
builder.Services.AddScoped<ClassService>();
builder.Services.AddScoped<IHoldRepository, HoldRepository>();
builder.Services.AddScoped<HoldService>();
builder.Services.AddOptions<HoldOptions>()
    .Configure(options => options.DurationSeconds = builder.Configuration.GetValue("HOLD_DURATION_SECONDS", 600))
    .Validate(options => options.DurationSeconds > 0, "HOLD_DURATION_SECONDS must be a positive integer.")
    .ValidateOnStart();

var app = builder.Build();

// Compose waits for PostgreSQL; apply versioned schema changes before accepting requests.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.UseExceptionHandler();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
