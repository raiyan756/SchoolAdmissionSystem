namespace SchoolAdmission.Api.DTOs;

public record HoldDetailsResponse(Guid HoldId, Guid ClassId, string Status, DateTimeOffset ExpiresAt);
