const radioList = document.getElementById("radioList");
const audioPlayer = document.getElementById("audioPlayer");
const playPauseButton = document.getElementById("playPauseButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const volumeControl = document.getElementById("volumeControl");
const currentStationDisplay = document.getElementById("currentStation");

const stationIDs = [
    { id: 207, name: "Open FM - Vixa" },
    { id: 160, name: "Open FM - Dance" },
    { id: 163, name: "Open FM - Do Auta" },
    { id: 169, name: "Open FM - 500 Party Hits" }
];

let currentStationIndex = 0;
let isPlaying = false;
let hls = null; // Obiekt HLS.js

// Funkcja generująca URL do API
function createApiUrl(stationId) {
    return `https://open.fm/api/user/token?fp=https://stream-cdn-1.open.fm/OFM${stationId}/ngrp:standard/playlist.m3u8`;
}

// Pobiera URL strumienia z API OpenFM
async function fetchStreamUrl(stationId) {
    const apiUrl = createApiUrl(stationId);
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data.url; // Pobiera URL strumienia z odpowiedzi API
    } catch (error) {
        console.error(`Błąd podczas pobierania strumienia dla stacji ${stationId}:`, error);
        return null;
    }
}

// Aktualizuje odtwarzacz z nową stacją
async function updatePlayer() {
    const station = stationIDs[currentStationIndex];
    const streamUrl = await fetchStreamUrl(station.id);

    if (streamUrl) {
        // Obsługa HLS (M3U8) z HLS.js
        if (Hls.isSupported()) {
            if (hls) {
                hls.destroy(); // Zniszcz poprzednią instancję HLS.js
            }
            hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(audioPlayer);
        } else if (audioPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Native support dla HLS
            audioPlayer.src = streamUrl;
        } else {
            alert("Twoja przeglądarka nie obsługuje odtwarzania tego strumienia.");
            return;
        }

        currentStationDisplay.textContent = `Odtwarzanie: ${station.name}`;
        if (isPlaying) {
            audioPlayer.play();
        }
    } else {
        alert("Nie udało się pobrać strumienia.");
    }
}

// Obsługuje przejście do poprzedniej stacji
function playPreviousStation() {
    if (currentStationIndex > 0) {
        currentStationIndex--;
        updatePlayer();
    }
}

// Obsługuje przejście do następnej stacji
function playNextStation() {
    if (currentStationIndex < stationIDs.length - 1) {
        currentStationIndex++;
        updatePlayer();
    }
}

// Pauzowanie i wznawianie odtwarzania
function togglePlayPause() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        isPlaying = true;
        playPauseButton.textContent = "Pauza";
    } else {
        audioPlayer.pause();
        isPlaying = false;
        playPauseButton.textContent = "Graj";
    }
}

// Renderuje listę stacji
function renderStations() {
    radioList.innerHTML = '';
    stationIDs.forEach((station, index) => {
        const stationElement = document.createElement("div");
        stationElement.className = "station";

        const stationName = document.createElement("span");
        stationName.textContent = station.name;

        const playButton = document.createElement("button");
        playButton.textContent = "Graj";
        playButton.onclick = async () => {
            currentStationIndex = index;
            await updatePlayer();
            audioPlayer.play();
            isPlaying = true;
            playPauseButton.textContent = "Pauza";
        };

        stationElement.append(stationName, playButton);
        radioList.appendChild(stationElement);
    });
}

// Inicjalizacja
renderStations();
updatePlayer();

playPauseButton.onclick = togglePlayPause;
previousButton.onclick = playPreviousStation;
nextButton.onclick = playNextStation;
volumeControl.oninput = () => (audioPlayer.volume = volumeControl.value);
