
interface SearchButtonsProps {
  title: string;
  artist?: string;
}

export function SearchButtons({ title, artist }: SearchButtonsProps) {
  if (!title || title === 'Brak Informacji') return null;

  const searchQuery = artist ? `${title} ${artist}` : title;
  const ytMusicUrl = `https://music.youtube.com/search?q=${encodeURIComponent(searchQuery)}`;
  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`;

  return (
    <div className="flex gap-2 ml-auto shrink-0">
      <a
        href={ytMusicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-red-600/20 hover:bg-red-600/40 flex items-center justify-center transition-colors"
        title="Szukaj w YouTube Music"
      >
        <img
          src="/ikony/youtube-music.webp"
          alt="YouTube Music"
          width={16}
          height={16}
          decoding="async"
        />
      </a>
      <a
        href={spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-green-600/20 hover:bg-green-600/40 flex items-center justify-center transition-colors"
        title="Szukaj w Spotify"
      >
        <img
          src="/ikony/spotify.png"
          alt="Spotify"
          width={16}
          height={16}
          decoding="async"
        />
      </a>
    </div>
  );
}
