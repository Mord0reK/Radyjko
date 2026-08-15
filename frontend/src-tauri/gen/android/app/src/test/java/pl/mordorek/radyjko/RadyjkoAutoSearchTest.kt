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

    @Test
    fun `prefers the most specific station when names share a prefix`() {
        val voxStations = listOf(
            station(3, "Vox FM", "voxfm"),
            station(4, "Vox FM Best Lista", "voxfm-bestlista"),
            station(5, "Vox FM DJ Mix", "voxfm-djmix"),
        )

        assertEquals(3L, RadyjkoAutoService.findStationByQuery("Odtwórz stację Vox FM", voxStations)?.id)
        assertEquals(4L, RadyjkoAutoService.findStationByQuery("Vox FM Best Lista", voxStations)?.id)
        assertEquals(5L, RadyjkoAutoService.findStationByQuery("Vox FM DJ Mixes", voxStations)?.id)
    }

    private fun station(id: Long, name: String, shortName: String) = AutoStationArgs().apply {
        this.id = id
        this.name = name
        this.shortName = shortName
    }
}
