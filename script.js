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
    { url: "https://s2.radioparty.pl:7000/djmixes?nocache=7379", name: "Radioparty - DJ Mixes", shortName: "rp-djmixes", isOpenFM: false },
    { url: "https://s2.radioparty.pl:7000/stream?nocache=3295", name: "Radioparty - Kanal Glowny", shortName: "rp-kanalglowny", isOpenFM: false },
    { url: "https://radio.stream.smcdn.pl/timeradio-p/6020-1.aac/playlist.m3u8", name: "VOX FM - DJ Mix", shortName: "voxfm-djmix", isOpenFM: false },
    { url: "https://radio.stream.smcdn.pl/timeradio-p/3990-1.aac/playlist.m3u8", name: "VOX FM", shortName: "voxfm", isOpenFM: false },
    { url: "https://radio.stream.smcdn.pl/timeradio-p/6100-1.aac/playlist.m3u8", name: "VOX FM - Best Lista", shortName: "voxfm-bestlista", isOpenFM: false },
    { url: "https://rs6-krk2.rmfstream.pl/rmf_fm", name: "RMF FM", shortName: "rmf-fm", isOpenFM: false },
    { url: "https://rs103-krk.rmfstream.pl/rmf_maxxx", name: "RMF MAXX", shortName: "rmf-maxxx", isOpenFM: false },
    { url: "https://rs6-krk2.rmfstream.pl/rmf_hop_bec", name: "RMF MAXX Hop Bęc", shortName: "rmf-maxxx-hop-bec", isOpenFM: false },
    { url: "https://rs6-krk2.rmfstream.pl/rmf_party", name: "RMF Party", shortName: "rmf-party", isOpenFM: false },
    { url: "https://rs6-krk2.rmfstream.pl/rmf_dance", name: "RMF Dance", shortName: "rmf-dance", isOpenFM: false },
    { url: "https://radio.stream.smcdn.pl/timeradio-p/2060-1.aac/playlist.m3u8", name: "ESKA Siedlce", shortName: "eska-siedlce", isOpenFM: false },
    { url: "https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO_ZETAAC.aac?dist=zet", name: "Radio ZET", shortName: "radio-zet", isOpenFM: false },
    { url: "https://22733.live.streamtheworld.com/ZET_DANCEAAC.aac", name: "Radio Zet Dance", shortName: "radiozet-dance", isOpenFM: false },
    { url: "https://zt04.cdn.eurozet.pl/ZETPAR.mp3", name: "Radio Zet Party", shortName: "radiozet-party", isOpenFM: false },
    { url: "https://waw.ic.smcdn.pl/6110-1.mp3", name: "ESKA 2 - Disco Polo", shortName: "eska2-discopolo", isOpenFM: false },
    { url: "https://s1.slotex.pl:7432/stream/1/?sid=1", name: "Disco Party", shortName: "disco-party", isOpenFM: false },
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
        // Zniszcz poprzednią instancję HLS jeśli istnieje
        if (hls) {
            hls.destroy();
            hls = null;
        }

        if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
            // Obsługa strumieni HLS (m3u8)
            hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(audioPlayer);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                if (isPlaying) {
                    audioPlayer.play().catch(e => console.error('Błąd odtwarzania:', e));
                }
            });
        } else if (streamUrl.includes('.aac') || streamUrl.includes('timeradio-p')) {
            // Obsługa strumieni AAC
            audioPlayer.src = streamUrl;
            audioPlayer.type = 'audio/aac';
            if (isPlaying) {
                audioPlayer.play().catch(e => console.error('Błąd odtwarzania:', e));
            }
        } else {
            // Pozostałe formaty
            audioPlayer.src = streamUrl;
            if (isPlaying) {
                audioPlayer.play().catch(e => console.error('Błąd odtwarzania:', e));
            }
        }

        currentStationDisplay.textContent = `Odtwarzanie: ${station.name}`;
        if (!isPlaying) {
            audioPlayer.pause();
            playPauseButton.textContent = "Graj";
        } else {
            playPauseButton.textContent = "Pauza";
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
        stationElement.style.cursor = "pointer"; // Dodaje kursor pointer

        const stationName = document.createElement("span");
        stationName.textContent = station.name;

        const playButton = document.createElement("button");
        playButton.textContent = "Graj";

        // Funkcja do odtwarzania stacji
        const playStation = async () => {
            currentStationIndex = index;
            await updatePlayer();
            audioPlayer.play();
            isPlaying = true;
            playPauseButton.textContent = "Pauza";
        };

        // Dodanie obsługi kliknięcia na całe pole stacji
        stationElement.onclick = (e) => {
            // Sprawdzamy czy kliknięcie nie było na przycisku
            if (!e.target.matches('button')) {
                playStation();
            }
        };

        // Obsługa przycisku pozostaje bez zmian
        playButton.onclick = (e) => {
            e.stopPropagation(); // Zapobiega wywołaniu kliknięcia na całym elemencie
            playStation();
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

// Zaktualizuj event handler dla volumeControl
volumeControl.oninput = (e) => {
    const value = e.target.value;
    audioPlayer.volume = value;
    // Aktualizacja gradientu tła
    const percent = value * 100;
    e.target.style.background = `linear-gradient(to right, #008CBA 0%, #008CBA ${percent}%, #404040 ${percent}%, #404040 100%)`;
};

// Dodaj inicjalizację początkowego gradientu
volumeControl.style.background = 'linear-gradient(to right, #008CBA 0%, #008CBA 100%, #404040 100%)';

playPauseButton.onclick = togglePlayPause;
previousButton.onclick = playPreviousStation;
nextButton.onclick = playNextStation;
volumeControl.oninput = (e) => {
    const value = e.target.value;
    audioPlayer.volume = value;
    // Aktualizacja gradientu tła
    const percent = value * 100;
    e.target.style.background = `linear-gradient(to right, #008CBA 0%, #008CBA ${percent}%, #404040 ${percent}%, #404040 100%)`;
};

// Dodaj inicjalizację początkowego gradientu
volumeControl.style.background = 'linear-gradient(to right, #008CBA 0%, #008CBA 100%, #404040 100%)';
