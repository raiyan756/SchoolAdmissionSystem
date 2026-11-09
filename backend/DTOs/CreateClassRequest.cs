using System.ComponentModel.DataAnnotations;

namespace SchoolAdmission.Api.DTOs;

public class CreateClassRequest
{
    [Required]
    [StringLength(200)]
    public string Name { get; init; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int TotalSeats { get; init; }
}
