using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Repositories.Interfaces;

public interface IHoldRepository
{
    Task<DateTimeOffset> GetDatabaseTimeAsync(CancellationToken cancellationToken);
    Task ExpireForClassAsync(Guid classId, DateTimeOffset now, CancellationToken cancellationToken);
    Task<bool> HasActiveAsync(Guid classId, string studentId, CancellationToken cancellationToken);
    Task<int> CountOccupiedAsync(Guid classId, CancellationToken cancellationToken);
    void Add(Hold hold);
}
