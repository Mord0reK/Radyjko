const radioList = document.getElementById("radioList");
const audioPlayer = document.getElementById("audioPlayer");
const playPauseButton = document.getElementById("playPauseButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const volumeControl = document.getElementById("volumeControl");
const currentStationDisplay = document.getElementById("currentStation");

// Stan aplikacji
let currentStation = null;
let stations = [];
let currentStationIndex = -1;

// Funkcja do załadowania pliku Radia.txt
async function loadStations() {
    try {
        const response = await fetch('Radia.txt');
        const text = await response.text();

        stations = text.split('\n')
            .map(line => {
                const urlMatch = line.match(/URL:\s*(https?.*?)(?=\s*;)/);
                const nameMatch = line.match(/Nazwa:\s*(.*?)(?=\s*$)/);

                if (urlMatch && nameMatch) {
                    return { name: nameMatch[1], url: urlMatch[1] };
                }
                return null;
            })
            .filter(station => station !== null);

        renderStations();
    } catch (error) {
        console.error("Błąd podczas ładowania pliku:", error);
    }
}

function renderStations() {
    radioList.innerHTML = '';
    stations.forEach((station, index) => {
        const stationElement = document.createElement("div");
        stationElement.className = "station";

        const stationName = document.createElement("span");
        stationName.textContent = station.name;

        const playButton = document.createElement("button");
        playButton.textContent = "Graj";
        playButton.addEventListener("click", () => {
            currentStationIndex = index;
            playStation(station);
        });

        stationElement.appendChild(stationName);
        stationElement.appendChild(playButton);
        radioList.appendChild(stationElement);
    });
}

function playStation(station) {
    audioPlayer.src = station.url;
    audioPlayer.play();
    playPauseButton.textContent = "Pauza";
    currentStationDisplay.textContent = "Odtwarzanie: " + station.name;

    // Aktualizacja metadanych Media Session
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: station.name,
            artist: '',
            album: '',
        });
    }
}

function togglePlayPause() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseButton.textContent = "Pauza";
    } else {
        audioPlayer.pause();
        playPauseButton.textContent = "Graj";
    }
}

function playPreviousStation() {
    if (currentStationIndex > 0) {
        currentStationIndex--;
        playStation(stations[currentStationIndex]);
    }
}

function playNextStation() {
    if (currentStationIndex < stations.length - 1) {
        currentStationIndex++;
        playStation(stations[currentStationIndex]);
    }
}

// Dodaj event listenery dla przycisków
playPauseButton.addEventListener("click", togglePlayPause);
previousButton.addEventListener("click", playPreviousStation);
nextButton.addEventListener("click", playNextStation);
volumeControl.addEventListener("input", () => {
    audioPlayer.volume = volumeControl.value;
});

// Ustawienia Media Session API
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
        togglePlayPause();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        togglePlayPause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPreviousStation();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNextStation();
    });
}

// Załaduj stacje radiowe
loadStations();
