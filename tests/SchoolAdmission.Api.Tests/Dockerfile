FROM mcr.microsoft.com/dotnet/sdk:10.0
WORKDIR /tests

COPY SchoolAdmission.Api.Tests.csproj .
RUN dotnet restore
COPY . .
RUN dotnet build -c Release --no-restore

ENTRYPOINT ["dotnet", "test", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]
