using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.DTOs;
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

    public Task<Guid?> GetClassIdAsync(Guid holdId, CancellationToken cancellationToken)
        => db.Holds.Where(x => x.Id == holdId).Select(x => (Guid?)x.ClassId).SingleOrDefaultAsync(cancellationToken);

    public Task<Hold?> GetByIdAsync(Guid holdId, CancellationToken cancellationToken)
        => db.Holds.SingleOrDefaultAsync(x => x.Id == holdId, cancellationToken);

    public Task<List<MyHoldResponse>> GetForStudentAsync(string studentId, DateTimeOffset now, CancellationToken cancellationToken)
        => db.Holds.AsNoTracking().Where(x => x.StudentId == studentId)
            .OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id)
            .Select(x => new MyHoldResponse(x.Id, x.ClassId, x.Class.Name,
                x.Status == HoldStatus.Held && x.ExpiresAt <= now ? "EXPIRED" : x.Status.ToString().ToUpperInvariant(),
                x.ExpiresAt))
            .ToListAsync(cancellationToken);

    public Task<List<Guid>> GetExpiredClassIdsAsync(DateTimeOffset now, CancellationToken cancellationToken)
        => db.Holds.Where(x => x.Status == HoldStatus.Held && x.ExpiresAt <= now)
            .Select(x => x.ClassId).Distinct().OrderBy(x => x).Take(100).ToListAsync(cancellationToken);
}
