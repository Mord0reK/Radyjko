// Lista ID stacji
const STATION_IDS = [57, 207, 160, 163, 164, 169, 165, 166, 180];

// Funkcja do generowania URL API
function createApiUrl(stationId) {
  return `https://open.fm/api/user/token?fp=https://stream-cdn-1.open.fm/OFM${stationId}/ngrp:standard/playlist.m3u8`;
}

// Funkcja do pobrania URL streamu z API
async function fetchStreamUrl(stationId) {
  try {
    const response = await fetch(createApiUrl(stationId));
    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error(`Error fetching URL for station ${stationId}:`, error);
    return null;
  }
}

// Funkcja do załadowania listy stacji
async function loadStations() {
  const stationListElement = document.getElementById("station-list");
  for (const stationId of STATION_IDS) {
    const streamUrl = await fetchStreamUrl(stationId);
    if (streamUrl) {
      const listItem = document.createElement("li");
      listItem.innerHTML = `
        <a href="${streamUrl}" target="_blank">Otwórz stream stacji ${stationId}</a>
      `;
      stationListElement.appendChild(listItem);
    } else {
      console.warn(`Stream URL dla stacji ${stationId} jest niedostępny.`);
    }
  }
}

// Inicjalizacja strony
loadStations();