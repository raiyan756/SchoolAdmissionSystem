namespace SchoolAdmission.Api.DTOs;

public record HoldResponse(Guid HoldId, Guid ClassId, string StudentId, string Status, DateTimeOffset ExpiresAt);
