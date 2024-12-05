// Elementy HTML
const radioList = document.getElementById("radioList");
const audioPlayer = document.getElementById("audioPlayer");
const playPauseButton = document.getElementById("playPauseButton");
const volumeControl = document.getElementById("volumeControl");

// Aktualna stacja
let currentStation = null;

// Funkcja do załadowania pliku Radia.txt
async function loadStations() {
    try {
        const response = await fetch('Radia.txt'); // Załaduj plik Radia.txt
        const text = await response.text(); // Pobierz tekst

        // Przetwarzanie tekstu
        const stations = text.split('\n').map(line => {
            const urlMatch = line.match(/URL:\s*(https?.*?)(?=\s*;)/); // Wyszukaj URL
            const nameMatch = line.match(/Nazwa:\s*(.*?)(?=\s*$)/); // Wyszukaj nazwę stacji

            if (urlMatch && nameMatch) {
                return { name: nameMatch[1], url: urlMatch[1] };
            }
            return null; // Jeśli linia nie pasuje do wzorca, pomijamy ją
        }).filter(station => station !== null); // Usuń puste wpisy

        // Generowanie listy stacji
        stations.forEach(station => {
            // Tworzenie kontenera stacji
            const stationElement = document.createElement("div");
            stationElement.className = "station";

            // Nazwa stacji
            const stationName = document.createElement("span");
            stationName.textContent = station.name;

            // Przycisk "Graj"
            const playButton = document.createElement("button");
            playButton.textContent = "Graj";
            playButton.addEventListener("click", () => {
                playStation(station);
            });

            // Dodanie nazwy i przycisku do kontenera stacji
            stationElement.appendChild(stationName);
            stationElement.appendChild(playButton);

            // Dodanie kontenera stacji do listy
            radioList.appendChild(stationElement);
        });
    } catch (error) {
        console.error("Błąd podczas ładowania pliku:", error);
    }
}

// Funkcja do odtwarzania stacji
function playStation(station) {
    if (currentStation !== station) {
        currentStation = station;
        audioPlayer.src = station.url;
        audioPlayer.play();
        playPauseButton.textContent = "Pauza";
    } else if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseButton.textContent = "Pauza";
    } else {
        audioPlayer.pause();
        playPauseButton.textContent = "Graj";
    }
}

// Obsługa przycisku Graj/Pauza
playPauseButton.addEventListener("click", () => {
    if (currentStation) {
        if (audioPlayer.paused) {
            audioPlayer.play();
            playPauseButton.textContent = "Pauza";
        } else {
            audioPlayer.pause();
            playPauseButton.textContent = "Graj";
        }
    }
});

// Obsługa regulacji głośności
volumeControl.addEventListener("input", () => {
    audioPlayer.volume = volumeControl.value;
});

// Załaduj stacje po załadowaniu strony
window.onload = loadStations;