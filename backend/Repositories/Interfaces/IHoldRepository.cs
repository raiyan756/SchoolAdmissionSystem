using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.DTOs;

namespace SchoolAdmission.Api.Repositories.Interfaces;

public interface IHoldRepository
{
    Task<DateTimeOffset> GetDatabaseTimeAsync(CancellationToken cancellationToken);
    Task ExpireForClassAsync(Guid classId, DateTimeOffset now, CancellationToken cancellationToken);
    Task<bool> HasActiveAsync(Guid classId, string studentId, CancellationToken cancellationToken);
    Task<int> CountOccupiedAsync(Guid classId, CancellationToken cancellationToken);
    Task<Guid?> GetClassIdAsync(Guid holdId, CancellationToken cancellationToken);
    Task<Hold?> GetByIdAsync(Guid holdId, CancellationToken cancellationToken);
    Task<List<MyHoldResponse>> GetForStudentAsync(string studentId, DateTimeOffset now, CancellationToken cancellationToken);
    Task<List<Guid>> GetExpiredClassIdsAsync(DateTimeOffset now, CancellationToken cancellationToken);
    void Add(Hold hold);
}
