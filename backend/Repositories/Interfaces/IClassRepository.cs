using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Repositories.Interfaces;

public interface IClassRepository
{
    void Add(SchoolClass schoolClass);
    Task<SchoolClass?> GetForUpdateAsync(Guid classId, CancellationToken cancellationToken);
    Task<List<ClassDetailsResponse>> GetAllAsync(DateTimeOffset now, CancellationToken cancellationToken);
    Task<ClassDetailsResponse?> GetByIdAsync(Guid classId, DateTimeOffset now, CancellationToken cancellationToken);
}
