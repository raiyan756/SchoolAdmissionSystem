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

public enum HoldActionResult { Success, NotFound, Forbidden, NotActive, AlreadyConfirmed }

public class HoldService(IClassRepository classes, IHoldRepository holds, AppDbContext db, IOptions<HoldOptions> options)
{
    public async Task<HoldCreationResult> CreateAsync(Guid classId, string studentId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        var schoolClass = await classes.GetForUpdateAsync(classId, cancellationToken);
        if (schoolClass is null)
            return new(null, HoldCreationError.ClassNotFound);

        // Creation, confirmation, cancellation and expiry all lock the class first.
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

    public async Task<HoldDetailsResponse?> GetByIdAsync(Guid holdId, CancellationToken cancellationToken)
    {
        var hold = await holds.GetByIdAsync(holdId, cancellationToken);
        if (hold is null) return null;

        var now = await holds.GetDatabaseTimeAsync(cancellationToken);
        var status = hold.Status == HoldStatus.Held && hold.ExpiresAt <= now ? HoldStatus.Expired : hold.Status;
        return new(hold.Id, hold.ClassId, status.ToString().ToUpperInvariant(), hold.ExpiresAt);
    }

    public async Task<List<MyHoldResponse>> GetForStudentAsync(string studentId, CancellationToken cancellationToken)
        => await holds.GetForStudentAsync(studentId, await holds.GetDatabaseTimeAsync(cancellationToken), cancellationToken);

    public Task<HoldActionResult> ConfirmAsync(Guid holdId, string studentId, CancellationToken cancellationToken)
        => ChangeStatusAsync(holdId, studentId, HoldStatus.Confirmed, cancellationToken);

    public Task<HoldActionResult> CancelAsync(Guid holdId, string studentId, CancellationToken cancellationToken)
        => ChangeStatusAsync(holdId, studentId, HoldStatus.Cancelled, cancellationToken);

    private async Task<HoldActionResult> ChangeStatusAsync(Guid holdId, string studentId, HoldStatus target, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        // Resolve the immutable class ID without tracking the hold; reload it after locking and expiry.
        var classId = await holds.GetClassIdAsync(holdId, cancellationToken);
        if (classId is null || await classes.GetForUpdateAsync(classId.Value, cancellationToken) is null)
            return HoldActionResult.NotFound;

        var now = await holds.GetDatabaseTimeAsync(cancellationToken);
        await holds.ExpireForClassAsync(classId.Value, now, cancellationToken);
        var hold = await holds.GetByIdAsync(holdId, cancellationToken);

        var result = hold is null ? HoldActionResult.NotFound
            : hold.StudentId != studentId ? HoldActionResult.Forbidden
            : hold.Status == target ? HoldActionResult.Success
            : hold.Status == HoldStatus.Confirmed ? HoldActionResult.AlreadyConfirmed
            : hold.Status != HoldStatus.Held ? HoldActionResult.NotActive
            : HoldActionResult.Success;

        if (result == HoldActionResult.Success && hold!.Status != target)
        {
            hold.Status = target;
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task ExpireDueAsync(CancellationToken cancellationToken)
    {
        var dueClasses = await holds.GetExpiredClassIdsAsync(await holds.GetDatabaseTimeAsync(cancellationToken), cancellationToken);
        foreach (var classId in dueClasses)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
            if (await classes.TryGetForUpdateAsync(classId, cancellationToken) is null) continue;

            var now = await holds.GetDatabaseTimeAsync(cancellationToken);
            await holds.ExpireForClassAsync(classId, now, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
    }
}
