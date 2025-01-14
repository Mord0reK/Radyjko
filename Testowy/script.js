const radioList = document.getElementById("radioList");
const audioPlayer = document.getElementById("audioPlayer");
const playPauseButton = document.getElementById("playPauseButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const volumeControl = document.getElementById("volumeControl");
const currentStationDisplay = document.getElementById("currentStation");

let currentStationIndex = -1;
let stations = [];

// Funkcja do załadowania pliku Radia.txt
fetch('Radia.txt')
    .then(response => response.text())
    .then(text => {
        stations = text.split('\n')
            .map(line => {
                const urlMatch = line.match(/URL:\s*(https?.*?)(?=\s*;)/);
                const nameMatch = line.match(/Nazwa:\s*(.*?)(?=\s*$)/);

                return urlMatch && nameMatch ? { name: nameMatch[1], url: urlMatch[1] } : null;
            })
            .filter(Boolean);

        renderStations();
    });

function renderStations() {
    radioList.innerHTML = '';
    stations.forEach((station, index) => {
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

function playStation(index) {
    currentStationIndex = index;
    const station = stations[index];
    audioPlayer.src = station.url;
    audioPlayer.play();
    playPauseButton.textContent = "Pauza";
    currentStationDisplay.textContent = `Odtwarzanie: ${station.name}`;
    document.title = station.name;
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
    if (currentStationIndex > 0) playStation(currentStationIndex - 1);
}

function playNextStation() {
    if (currentStationIndex < stations.length - 1) playStation(currentStationIndex + 1);
}

playPauseButton.onclick = togglePlayPause;
previousButton.onclick = playPreviousStation;
nextButton.onclick = playNextStation;
volumeControl.oninput = () => (audioPlayer.volume = volumeControl.value);
