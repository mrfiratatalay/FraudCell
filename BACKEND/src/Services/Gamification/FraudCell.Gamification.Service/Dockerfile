# Bu Dockerfile repository kökü `BACKEND/` build context'i ile calistirilmalidir
# (bkz. docker-compose.yml), cunku proje Directory.Packages.props, Directory.Build.props,
# global.json ve BuildingBlocks'a kok gorelidir.

# SDK/runtime image'lari global.json'daki `10.0.403` ile birebir sabitlenmistir
#. Floating `10.0`
# tag'i host'ta kurulu olandan daha yeni bir SDK cekip, o SDK'nin daha sikilastirilmis
# "latest-recommended" analyzer setiyle build'i kirabiliyor.

# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:10.0.403 AS build
WORKDIR /src

COPY global.json Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/BuildingBlocks/FraudCell.BuildingBlocks/FraudCell.BuildingBlocks.csproj src/BuildingBlocks/FraudCell.BuildingBlocks/
COPY src/Services/Gamification/FraudCell.Gamification.Service/FraudCell.Gamification.Service.csproj src/Services/Gamification/FraudCell.Gamification.Service/

RUN dotnet restore src/Services/Gamification/FraudCell.Gamification.Service/FraudCell.Gamification.Service.csproj

COPY src/BuildingBlocks/FraudCell.BuildingBlocks/ src/BuildingBlocks/FraudCell.BuildingBlocks/
COPY src/Services/Gamification/FraudCell.Gamification.Service/ src/Services/Gamification/FraudCell.Gamification.Service/

RUN dotnet publish src/Services/Gamification/FraudCell.Gamification.Service/FraudCell.Gamification.Service.csproj \
    -c Release -o /app/publish --no-restore

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0.14 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system fraudcell \
    && useradd --system --gid fraudcell --home-dir /app --shell /usr/sbin/nologin fraudcell \
    && mkdir -p /keys/identity \
    && chown -R fraudcell:fraudcell /app /keys/identity

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

USER fraudcell

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
    CMD curl -f http://localhost:8080/health/ready || exit 1

ENTRYPOINT ["dotnet", "FraudCell.Gamification.Service.dll"]
