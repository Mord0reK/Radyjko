package pl.mordorek.radyjko

import org.junit.Assert.assertEquals
import org.junit.Test

class RadyjkoAutoSearchTest {
    private val stations = listOf(
        station(1, "Eska", "eska-a"),
        station(2, "Radio ZET", "radio-zet"),
    )

    @Test
    fun `matches a natural Polish voice command`() {
        assertEquals(1L, RadyjkoAutoService.findStationByQuery("Włącz radio Eskę", stations)?.id)
    }

    @Test
    fun `matches station short name with a dash`() {
        assertEquals(2L, RadyjkoAutoService.findStationByQuery("radio zet", stations)?.id)
    }

    private fun station(id: Long, name: String, shortName: String) = AutoStationArgs().apply {
        this.id = id
        this.name = name
        this.shortName = shortName
    }
}
