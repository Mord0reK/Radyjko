const radioList = document.getElementById("radioList");
const audioPlayer = document.getElementById("audioPlayer");
const currentStationDisplay = document.getElementById("currentStation");

const stationIDs = [
    { id: 207, name: "Open FM - Vixa" },
    { id: 160, name: "Open FM - Dance" },
    { id: 163, name: "Open FM - Do Auta" },
    { id: 169, name: "Open FM - 500 Party Hits" }
];

// Funkcja generująca URL do pobrania tokena
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
        playButton.onclick = () => playStation(index);

        stationElement.append(stationName, playButton);
        radioList.appendChild(stationElement);
    });
}

// Odtwarza wybraną stację
async function playStation(index) {
    const station = stationIDs[index];
    const streamUrl = await fetchStreamUrl(station.id);

    if (streamUrl) {
        audioPlayer.src = streamUrl;
        audioPlayer.play();
        currentStationDisplay.textContent = `Odtwarzanie: ${station.name}`;
    } else {
        alert("Nie udało się pobrać strumienia.");
    }
}

// Inicjalizacja strony
renderStations();
