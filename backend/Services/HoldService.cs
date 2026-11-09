using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Repositories.Interfaces;

namespace SchoolAdmission.Api.Services;

public enum HoldCreationError { None, ClassNotFound, DuplicateActiveHold, NoSeatsAvailable }

public record HoldCreationResult(HoldResponse? Hold, HoldCreationError Error = HoldCreationError.None);

public class HoldService(IClassRepository classes, IHoldRepository holds, AppDbContext db, IOptions<HoldOptions> options)
{
    public async Task<HoldCreationResult> CreateAsync(Guid classId, string studentId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        var schoolClass = await classes.GetForUpdateAsync(classId, cancellationToken);
        if (schoolClass is null)
            return new(null, HoldCreationError.ClassNotFound);

        // All seat-changing operations must lock the class first, including future confirm/cancel flows.
        var now = await holds.GetDatabaseTimeAsync(cancellationToken);
        await holds.ExpireForClassAsync(classId, now, cancellationToken);

        if (await holds.HasActiveAsync(classId, studentId, cancellationToken))
        {
            await transaction.CommitAsync(cancellationToken);
            return new(null, HoldCreationError.DuplicateActiveHold);
        }

        if (await holds.CountOccupiedAsync(classId, cancellationToken) >= schoolClass.TotalSeats)
        {
            await transaction.CommitAsync(cancellationToken);
            return new(null, HoldCreationError.NoSeatsAvailable);
        }

        var hold = new Hold
        {
            ClassId = classId,
            StudentId = studentId,
            CreatedAt = now,
            ExpiresAt = now.AddSeconds(options.Value.DurationSeconds)
        };
        holds.Add(hold);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new(new HoldResponse(hold.Id, hold.ClassId, hold.StudentId, "HELD", hold.ExpiresAt));
    }
}
