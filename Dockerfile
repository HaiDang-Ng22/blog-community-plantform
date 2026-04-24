# Use the official .NET 9.0 SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy the solution file and project files
COPY ["BlogSystem.sln", "./"]
COPY ["Blog.API/Blog.API.csproj", "Blog.API/"]
COPY ["Blog.Application/Blog.Application.csproj", "Blog.Application/"]
COPY ["Blog.Domain/Blog.Domain.csproj", "Blog.Domain/"]
COPY ["Blog.Infrastructure/Blog.Infrastructure.csproj", "Blog.Infrastructure/"]

# Restore dependencies
RUN dotnet restore "BlogSystem.sln"

# Copy the rest of the source code
COPY . .

# Build and publish the API
WORKDIR "/src/Blog.API"
RUN dotnet publish "Blog.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Use the official ASP.NET Core runtime image to run the app
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final

# Create the folder structure mirroring the development environment
WORKDIR /app/Blog.API
COPY --from=build /app/publish .

WORKDIR /app
COPY --from=build /src/Blog.Web ./Blog.Web

# Set the working directory to where the dll is
WORKDIR /app/Blog.API

# Expose port 8080. Render dynamically maps the port.
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Blog.API.dll"]
