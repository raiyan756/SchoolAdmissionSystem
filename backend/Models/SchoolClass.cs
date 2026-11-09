namespace SchoolAdmission.Api.Models;

public class SchoolClass
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public int TotalSeats { get; set; }
}
