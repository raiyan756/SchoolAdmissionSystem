using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Repositories.Interfaces;

namespace SchoolAdmission.Api.Repositories;

public class HoldRepository(AppDbContext db) : IHoldRepository
{
    // Unlike CURRENT_TIMESTAMP, this is the time after any row-lock wait.
    public Task<DateTimeOffset> GetDatabaseTimeAsync(CancellationToken cancellationToken)
        => db.Database.SqlQuery<DateTimeOffset>($"SELECT clock_timestamp() AS \"Value\"")
            .SingleAsync(cancellationToken);

    public Task ExpireForClassAsync(Guid classId, DateTimeOffset now, CancellationToken cancellationToken)
        => db.Holds.Where(x => x.ClassId == classId && x.Status == HoldStatus.Held && x.ExpiresAt <= now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, HoldStatus.Expired), cancellationToken);

    public Task<bool> HasActiveAsync(Guid classId, string studentId, CancellationToken cancellationToken)
        => db.Holds.AnyAsync(x => x.ClassId == classId && x.StudentId == studentId
            && (x.Status == HoldStatus.Held || x.Status == HoldStatus.Confirmed), cancellationToken);

    public Task<int> CountOccupiedAsync(Guid classId, CancellationToken cancellationToken)
        => db.Holds.CountAsync(x => x.ClassId == classId
            && (x.Status == HoldStatus.Held || x.Status == HoldStatus.Confirmed), cancellationToken);

    public void Add(Hold hold) => db.Holds.Add(hold);
}
