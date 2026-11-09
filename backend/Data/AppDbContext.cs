using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    // Share one authoritative clock across allocation, reads and expiry; evaluate after lock waits.
    public Task<DateTimeOffset> GetDatabaseTimeAsync(CancellationToken cancellationToken)
        => Database.SqlQuery<DateTimeOffset>($"SELECT clock_timestamp() AS \"Value\"")
            .SingleAsync(cancellationToken);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var schoolClass = modelBuilder.Entity<SchoolClass>();
        schoolClass.ToTable("Classes", table =>
        {
            table.HasCheckConstraint("CK_Classes_TotalSeats", "\"TotalSeats\" > 0");
            table.HasCheckConstraint("CK_Classes_Name", "length(btrim(\"Name\")) > 0");
        });
        schoolClass.Property(x => x.Name).HasMaxLength(200).IsRequired();

        var hold = modelBuilder.Entity<Hold>();
        hold.ToTable("Holds", table =>
        {
            table.HasCheckConstraint("CK_Holds_StudentId", "\"StudentId\" ~ '^[0-9]{17}$'");
            table.HasCheckConstraint("CK_Holds_Status", "\"Status\" IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
            table.HasCheckConstraint("CK_Holds_ExpiresAt", "\"ExpiresAt\" > \"CreatedAt\"");
        });
        hold.Property(x => x.StudentId).HasMaxLength(17).IsRequired();
        hold.Property(x => x.Status)
            .HasConversion(value => value.ToString().ToUpperInvariant(), value => Enum.Parse<HoldStatus>(value, true))
            .HasMaxLength(9);
        hold.HasOne(x => x.Class).WithMany().HasForeignKey(x => x.ClassId)
            .OnDelete(DeleteBehavior.Restrict);

        // Expired HELD rows must be transitioned before a replacement hold is inserted.
        hold.HasIndex(x => new { x.StudentId, x.ClassId })
            .IsUnique()
            .HasFilter("\"Status\" IN ('HELD', 'CONFIRMED')");
        hold.HasIndex(x => new { x.ClassId, x.Status });
        hold.HasIndex(x => x.ExpiresAt).HasFilter("\"Status\" = 'HELD'");
    }
}
