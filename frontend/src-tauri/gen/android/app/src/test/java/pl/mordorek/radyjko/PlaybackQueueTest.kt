package pl.mordorek.radyjko

import org.junit.Assert.assertEquals
import org.junit.Test

class PlaybackQueueTest {
    private val stations = listOf(
        station(1, "eska-a"),
        station(2, "rmf-a"),
        station(3, "radio-zet-a"),
        station(4, "openfm-a"),
        station(5, "rmf-b"),
    )

    @Test
    fun `all stations match web ordering with favorites first and groups preserved`() {
        assertEquals(
            listOf(2L, 4L, 1L, 3L, 5L),
            orderedStations(stations, setOf(4L, 2L), PlaybackScope.ALL).map { it.id },
        )
    }

    @Test
    fun `favorites scope contains only favorite stations`() {
        assertEquals(
            listOf(2L, 4L, 5L),
            orderedStations(stations, setOf(2L, 4L, 5L), PlaybackScope.FAVORITES).map { it.id },
        )
    }

    @Test
    fun `adjacent station wraps inside active queue`() {
        val favorites = orderedStations(stations, setOf(2L, 4L, 5L), PlaybackScope.FAVORITES)

        assertEquals(5L, adjacentStationId(favorites, 4, 1))
        assertEquals(2L, adjacentStationId(favorites, 5, 1))
        assertEquals(5L, adjacentStationId(favorites, 2, -1))
    }

    @Test
    fun `removed active station starts at edge matching direction`() {
        val favorites = orderedStations(stations, setOf(2L, 5L), PlaybackScope.FAVORITES)

        assertEquals(2L, adjacentStationId(favorites, 4, 1))
        assertEquals(5L, adjacentStationId(favorites, 4, -1))
    }

    private fun station(id: Long, shortName: String) = AutoStationArgs().apply {
        this.id = id
        this.shortName = shortName
        name = shortName
    }
}
