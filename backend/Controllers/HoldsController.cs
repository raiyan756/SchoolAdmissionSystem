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
}
