using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("classes")]
public class ClassesController(ClassService classes) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ClassResponse>> Create(CreateClassRequest request, CancellationToken cancellationToken)
    {
        var result = await classes.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { classId = result.Id }, result);
    }

    [HttpGet]
    public async Task<ActionResult<List<ClassDetailsResponse>>> GetAll(CancellationToken cancellationToken)
        => Ok(await classes.GetAllAsync(cancellationToken));

    [HttpGet("{classId}")]
    public async Task<ActionResult<ClassDetailsResponse>> GetById(Guid classId, CancellationToken cancellationToken)
    {
        var result = await classes.GetByIdAsync(classId, cancellationToken);
        return result is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Class not found.")
            : Ok(result);
    }
}
