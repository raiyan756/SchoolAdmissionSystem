using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
public class HoldsController(HoldService holds) : ControllerBase
{
    [HttpPost("classes/{classId}/holds")]
    public async Task<ActionResult<HoldResponse>> Create(
        Guid classId,
        [FromHeader(Name = "X-Student-Id"), Required, RegularExpression(@"\A[0-9]{17}\z")] string studentId,
        CancellationToken cancellationToken)
    {
        var result = await holds.CreateAsync(classId, studentId, cancellationToken);
        return result.Error switch
        {
            HoldCreationError.ClassNotFound => Problem(statusCode: 404, title: "Class not found."),
            HoldCreationError.DuplicateActiveHold => Problem(statusCode: 409, title: "You already have an active hold or confirmed admission in this class."),
            HoldCreationError.NoSeatsAvailable => Problem(statusCode: 409, title: "No seats available in this class."),
            _ => StatusCode(StatusCodes.Status201Created, result.Hold)
        };
    }

    [HttpGet("holds/{holdId}")]
    public async Task<ActionResult<HoldDetailsResponse>> GetById(Guid holdId, CancellationToken cancellationToken)
    {
        var result = await holds.GetByIdAsync(holdId, cancellationToken);
        return result is null ? Problem(statusCode: 404, title: "Hold not found.") : Ok(result);
    }

    [HttpGet("me/holds")]
    public async Task<ActionResult<List<MyHoldResponse>>> GetMine(
        [FromHeader(Name = "X-Student-Id"), Required, RegularExpression(@"\A[0-9]{17}\z")] string studentId,
        CancellationToken cancellationToken)
        => Ok(await holds.GetForStudentAsync(studentId, cancellationToken));

    [HttpPost("holds/{holdId}/confirm")]
    public async Task<ActionResult<ConfirmHoldResponse>> Confirm(
        Guid holdId,
        [FromHeader(Name = "X-Student-Id"), Required, RegularExpression(@"\A[0-9]{17}\z")] string studentId,
        CancellationToken cancellationToken)
    {
        var result = await holds.ConfirmAsync(holdId, studentId, cancellationToken);
        return result == HoldActionResult.Success
            ? Ok(new ConfirmHoldResponse(holdId, "CONFIRMED")) : ActionError(result);
    }

    [HttpDelete("holds/{holdId}")]
    public async Task<IActionResult> Cancel(
        Guid holdId,
        [FromHeader(Name = "X-Student-Id"), Required, RegularExpression(@"\A[0-9]{17}\z")] string studentId,
        CancellationToken cancellationToken)
    {
        var result = await holds.CancelAsync(holdId, studentId, cancellationToken);
        return result == HoldActionResult.Success ? NoContent() : ActionError(result);
    }

    private ObjectResult ActionError(HoldActionResult result) => result switch
    {
        HoldActionResult.NotFound => Problem(statusCode: 404, title: "Hold not found."),
        HoldActionResult.Forbidden => Problem(statusCode: 403, title: "This hold belongs to another student."),
        HoldActionResult.AlreadyConfirmed => Problem(statusCode: 409, title: "A confirmed admission cannot be cancelled."),
        _ => Problem(statusCode: 409, title: "This hold is no longer active.")
    };
}
