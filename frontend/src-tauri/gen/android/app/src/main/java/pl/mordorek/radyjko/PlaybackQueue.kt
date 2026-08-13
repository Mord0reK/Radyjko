package pl.mordorek.radyjko

enum class PlaybackScope {
    ALL,
    FAVORITES,
}

fun orderedStations(
    stations: List<AutoStationArgs>,
    favorites: Set<Long>,
    scope: PlaybackScope,
): List<AutoStationArgs> {
    if (scope == PlaybackScope.FAVORITES) {
        return stations.filter { favorites.contains(it.id) }
    }

    val favoriteStations = stations.filter { favorites.contains(it.id) }
    val groupedStations = stations.filterNot { favorites.contains(it.id) }
        .groupBy { stationGroup(it.shortName) }
        .values
        .flatten()
    return favoriteStations + groupedStations
}

fun adjacentStationId(
    stations: List<AutoStationArgs>,
    activeStationId: Long?,
    direction: Int,
): Long? {
    if (stations.isEmpty()) return null

    val currentIndex = stations.indexOfFirst { it.id == activeStationId }
    if (currentIndex == -1) {
        return if (direction < 0) stations.last().id else stations.first().id
    }

    return stations[(currentIndex + direction + stations.size) % stations.size].id
}

private fun stationGroup(shortName: String): String = when {
    shortName.contains("rmf") -> "Grupa RMF"
    shortName.contains("radio-zet") ||
        shortName.contains("radiozet") ||
        shortName.contains("antyradio") ||
        shortName.contains("meloradio") -> "Eurozet"
    shortName.contains("eska") -> "Eska"
    shortName.contains("voxfm") -> "VoxFM"
    shortName.contains("openfm") -> "OpenFM"
    shortName.contains("radio-cmp") -> "Radio CMP"
    shortName.contains("rp-") -> "RadioParty"
    else -> "Inne"
}
