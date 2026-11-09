namespace SchoolAdmission.Api.DTOs;

public record ClassDetailsResponse(
    Guid Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);
