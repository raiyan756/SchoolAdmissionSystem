namespace SchoolAdmission.Api.Models;

public class Hold
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ClassId { get; set; }
    public required string StudentId { get; set; }
    public HoldStatus Status { get; set; } = HoldStatus.Held;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public SchoolClass Class { get; set; } = null!;
}
