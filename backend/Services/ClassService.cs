using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Repositories.Interfaces;

namespace SchoolAdmission.Api.Services;

public class ClassService(IClassRepository classes, AppDbContext db)
{
    public async Task<ClassResponse> CreateAsync(CreateClassRequest request, CancellationToken cancellationToken)
    {
        var schoolClass = new SchoolClass
        {
            Name = request.Name.Trim(),
            TotalSeats = request.TotalSeats
        };

        classes.Add(schoolClass);
        await db.SaveChangesAsync(cancellationToken);

        return new ClassResponse(schoolClass.Id, schoolClass.Name, schoolClass.TotalSeats);
    }

    public Task<List<ClassDetailsResponse>> GetAllAsync(CancellationToken cancellationToken)
        => classes.GetAllAsync(DateTimeOffset.UtcNow, cancellationToken);

    public Task<ClassDetailsResponse?> GetByIdAsync(Guid classId, CancellationToken cancellationToken)
        => classes.GetByIdAsync(classId, DateTimeOffset.UtcNow, cancellationToken);
}
