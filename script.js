const radioList = document.getElementById("radioList");
const audioPlayer = document.getElementById("audioPlayer");
const playPauseButton = document.getElementById("playPauseButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const volumeControl = document.getElementById("volumeControl");
const currentStationDisplay = document.getElementById("currentStation");

// Lista stacji (połączona z OpenFM i innymi stacjami)
const stations = [
    { id: 207, name: "Open FM - Vixa", shortName: "openfm-vixa", isOpenFM: true },
    { id: 160, name: "Open FM - Dance", shortName: "openfm-dance", isOpenFM: true },
    { id: 163, name: "Open FM - Do Auta", shortName: "openfm-doauta", isOpenFM: true },
    { id: 169, name: "Open FM - 500 Party Hits", shortName: "openfm-500partyhits", isOpenFM: true },
    { url: "https://radioparty.pl:8888/djmixes", name: "Radioparty - DJ Mixes", shortName: "rp-djmixes", isOpenFM: false },
    { url: "https://s2.radioparty.pl:7000/stream?nocache=5782", name: "Radioparty - Kanal Glowny", shortName: "rp-kanalglowny", isOpenFM: false },
    { url: "https://s1.slotex.pl:7432/stream/1/?sid=1", name: "Disco Party", shortName: "disco-party", isOpenFM: false },
    { url: "https://waw.ic.smcdn.pl/6020-1.mp3", name: "VOX FM - DJ Mix", shortName: "voxfm-djmix", isOpenFM: false },
    { url: "https://ic2.smcdn.pl/3990-1.mp3", name: "VOX FM", shortName: "voxfm", isOpenFM: false },
    { url: "https://waw.ic.smcdn.pl/6100-1.mp3", name: "VOX FM - Best Lista", shortName: "voxfm-bestlista", isOpenFM: false },
    { url: "https://rs6-krk2.rmfstream.pl/rmf_fm", name: "RMF FM", shortName: "rmf-fm", isOpenFM: false },
    { url: "https://rs103-krk.rmfstream.pl/rmf_maxxx", name: "RMF MAXX", shortName: "rmf-maxxx", isOpenFM: false },
    { url: "https://rs6-krk2.rmfstream.pl/rmf_party", name: "RMF Party", shortName: "rmf-party", isOpenFM: false },
    { url: "https://ic2.smcdn.pl/2060-1.mp3", name: "ESKA Siedlce", shortName: "eska-siedlce", isOpenFM: false },
    { url: "https://n-11-23.dcs.redcdn.pl/sc/o2/Eurozet/live/audio.livx?audio=5", name: "Radio ZET", shortName: "radio-zet", isOpenFM: false },
    { url: "https://zt05.cdn.eurozet.pl/ZETDAN.mp3?redirected=05/", name: "Radio Zet Dance", shortName: "radiozet-dance", isOpenFM: false },
    { url: "https://zt04.cdn.eurozet.pl/ZETPAR.mp3", name: "Radio Zet Party", shortName: "radiozet-party", isOpenFM: false },
    { url: "https://waw.ic.smcdn.pl/6110-1.mp3", name: "ESKA 2 - Disco Polo", shortName: "eska2-discopolo", isOpenFM: false },
    { url: "https://stream.rcs.revma.com/cvswvmyewzzuv", name: "Radio Disco", shortName: "radio-disco", isOpenFM: false }
];

let currentStationIndex = 0;
let isPlaying = false;
let hls = null;

// Pobiera URL strumienia OpenFM z API
async function fetchOpenFMStreamUrl(stationId) {
    const apiUrl = `https://open.fm/api/user/token?fp=https://stream-cdn-1.open.fm/OFM${stationId}/ngrp:standard/playlist.m3u8`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data.url;
    } catch (error) {
        console.error(`Błąd pobierania strumienia dla stacji OpenFM ID ${stationId}:`, error);
        return null;
    }
}

async function updatePlayer() {
    const station = stations[currentStationIndex];
    let streamUrl;

    if (station.isOpenFM) {
        streamUrl = await fetchOpenFMStreamUrl(station.id);
    } else {
        streamUrl = station.url;
    }

    if (streamUrl) {
        if (station.isOpenFM && Hls.isSupported()) {
            if (hls) {
                hls.destroy();
            }
            hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(audioPlayer);
        } else if (audioPlayer.canPlayType('application/vnd.apple.mpegurl') || !station.isOpenFM) {
            audioPlayer.src = streamUrl;
        } else {
            alert("Twoja przeglądarka nie obsługuje tego strumienia.");
            return;
        }

        currentStationDisplay.textContent = `Odtwarzanie: ${station.name}`;
        if (isPlaying && streamUrl) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
            playPauseButton.textContent = "Graj";
        }
    } else {
        alert(`Nie udało się odtworzyć stacji: ${station.name}`);
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
    if (currentStationIndex < stations.length - 1) {
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
    stations.forEach((station, index) => {
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

// Add this after the existing event listeners, just before renderStations();

// Media Session API Setup
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
        audioPlayer.play();
        isPlaying = true;
        playPauseButton.textContent = "Pauza";
    });

    navigator.mediaSession.setActionHandler('pause', () => {
        audioPlayer.pause();
        isPlaying = false;
        playPauseButton.textContent = "Graj";
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPreviousStation();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNextStation();
    });

    // Update metadata when station changes
    audioPlayer.addEventListener('play', () => {
        const currentStation = stations[currentStationIndex];
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentStation.name,
            artist: '',
            album: ''
        });
        document.title = currentStation.name;
    });
}

renderStations();


renderStations();

playPauseButton.onclick = togglePlayPause;
previousButton.onclick = playPreviousStation;
nextButton.onclick = playNextStation;
volumeControl.oninput = () => (audioPlayer.volume = volumeControl.value);
