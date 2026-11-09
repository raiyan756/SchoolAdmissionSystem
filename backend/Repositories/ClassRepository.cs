using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Repositories.Interfaces;

namespace SchoolAdmission.Api.Repositories;

public class ClassRepository(AppDbContext db) : IClassRepository
{
    public void Add(SchoolClass schoolClass) => db.Classes.Add(schoolClass);

    // The caller must hold a transaction until the seat allocation is committed.
    public Task<SchoolClass?> GetForUpdateAsync(Guid classId, CancellationToken cancellationToken)
        => db.Classes.FromSqlInterpolated($"SELECT * FROM \"Classes\" WHERE \"Id\" = {classId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

    public Task<List<ClassDetailsResponse>> GetAllAsync(DateTimeOffset now, CancellationToken cancellationToken)
        => WithSeatCounts(db.Classes.OrderBy(x => x.Name).ThenBy(x => x.Id), now)
            .ToListAsync(cancellationToken);

    public Task<ClassDetailsResponse?> GetByIdAsync(Guid classId, DateTimeOffset now, CancellationToken cancellationToken)
        => WithSeatCounts(db.Classes.Where(x => x.Id == classId), now)
            .SingleOrDefaultAsync(cancellationToken);

    private IQueryable<ClassDetailsResponse> WithSeatCounts(IQueryable<SchoolClass> classes, DateTimeOffset now)
        => classes.AsNoTracking()
            .Select(schoolClass => new
            {
                schoolClass.Id,
                schoolClass.Name,
                schoolClass.TotalSeats,
                HeldSeats = db.Holds.Count(hold => hold.ClassId == schoolClass.Id
                    && hold.Status == HoldStatus.Held && hold.ExpiresAt > now),
                ConfirmedSeats = db.Holds.Count(hold => hold.ClassId == schoolClass.Id
                    && hold.Status == HoldStatus.Confirmed)
            })
            .Select(schoolClass => new ClassDetailsResponse(
                schoolClass.Id,
                schoolClass.Name,
                schoolClass.TotalSeats,
                schoolClass.HeldSeats,
                schoolClass.ConfirmedSeats,
                schoolClass.TotalSeats - schoolClass.HeldSeats - schoolClass.ConfirmedSeats));
}
