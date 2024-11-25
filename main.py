import subprocess
import json
import threading
from flask import Flask, Response, stream_with_context
import http.server
import socketserver
import os

# Konfiguracja
STATION_IDS = [57, 207, 160, 163, 164, 169, 165, 166]  # Lista ID stacji
START_PORT = 5000  # Numer portu startowego dla strumieni
OUTPUT_FILE = "url.json"  # Plik do zapisu URL strumieni
WWW_PORT = 8000  # Port dla serwera WWW


# === Funkcja 1: Generowanie pliku url.json ===
def create_url(station_id):
    return f"https://open.fm/api/user/token?fp=https://stream-cdn-1.open.fm/OFM{station_id}/ngrp:standard/playlist.m3u8"

def fetch_url_from_api(url):
    try:
        curl_command = ["curl", "-s", url]
        response = subprocess.check_output(curl_command).decode("utf-8")
        data = json.loads(response)
        return data.get("url", None)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(f"Error fetching URL: {e}")
        return None

def generate_url_file(station_ids, start_port, output_file):
    result = []
    port = start_port

    for station_id in station_ids:
        url = create_url(station_id)
        print(f"Pobieram dane dla stacji o ID: {station_id}")
        stream_url = fetch_url_from_api(url)

        if stream_url:
            result.append({
                "url": stream_url,
                "port": port
            })
            port += 1

    with open(output_file, "w") as file:
        json.dump(result, file, indent=4)

    print(f"Dane zapisane do pliku: {output_file}")


# === Funkcja 2: Uruchamianie serwerów strumieniowych ===
def load_streams_from_file(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def generate_mp3_stream(m3u8_url):
    process = subprocess.Popen(
        ['ffmpeg', '-i', m3u8_url, '-f', 'mp3', '-'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    return process.stdout

def create_flask_app(m3u8_url):
    app = Flask(__name__)

    @app.route('/stream')
    def stream():
        return Response(stream_with_context(generate_mp3_stream(m3u8_url)), mimetype='audio/mpeg')

    return app

def run_stream_servers(file_path):
    streams = load_streams_from_file(file_path)

    for stream in streams:
        app = create_flask_app(stream["url"])
        threading.Thread(target=lambda: app.run(host='0.0.0.0', port=stream["port"]), daemon=True).start()

    print("Serwery strumieniowe uruchomione.")


# === Funkcja 3: Uruchamianie serwera WWW ===
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

def run_www_server(port):
    def start_server():
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print(f"Serwer WWW działa na porcie {port}")
            httpd.serve_forever()

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()


# === Główna funkcja ===
def main():
    print("=== Generowanie pliku url.json ===")
    generate_url_file(STATION_IDS, START_PORT, OUTPUT_FILE)

    print("\n=== Uruchamianie serwerów strumieniowych ===")
    run_stream_servers(OUTPUT_FILE)

    print("\n=== Uruchamianie serwera WWW ===")
    run_www_server(WWW_PORT)

    os.system("start http://localhost:8000")

    print("\nWszystkie serwery działają. Naciśnij Enter, aby zakończyć.")
    input()


# Uruchomienie programu
if __name__ == "__main__":
    main()
