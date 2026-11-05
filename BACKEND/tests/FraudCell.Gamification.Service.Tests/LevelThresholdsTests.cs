using FraudCell.Gamification.Service.Domain;
using Shouldly;
using Xunit;

namespace FraudCell.Gamification.Service.Tests;

public sealed class LevelThresholdsTests
{
    // Case §6.3: Bronz 0-499, Gumus 500-1499, Altin 1500-2999, Platin 3000+.
    [Theory]
    [InlineData(0, AnalystLevel.BRONZ)]
    [InlineData(499, AnalystLevel.BRONZ)]
    [InlineData(500, AnalystLevel.GUMUS)]
    [InlineData(1499, AnalystLevel.GUMUS)]
    [InlineData(1500, AnalystLevel.ALTIN)]
    [InlineData(2999, AnalystLevel.ALTIN)]
    [InlineData(3000, AnalystLevel.PLATIN)]
    public void Level_follows_the_point_ranges(long points, AnalystLevel expected) =>
        LevelThresholds.Calculate(points).ShouldBe(expected);
}
