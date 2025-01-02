import subprocess
import json
import threading
from flask import Flask, Response, stream_with_context, send_from_directory
from waitress import serve
import os

open_fm_id = [207, 160, 163, 169]

# === Część 1: Przygotowywanie lików do streamowania ===

def wczytywanie_linkow():
    streamy = []
    with open("url.txt", "r") as plik:
        for linia in plik:
            link, port = linia.strip().split(", ")
            streamy.append([link, port])
    return streamy

def pozyskaj_z_api(api):
    try:
        curl_command = ["curl", "-s", api]
        response = subprocess.check_output(curl_command).decode("utf-8")
        data = json.loads(response)
        return data.get("url", None)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(f"Error fetching URL: {e}")
        return None

def open_fm_streamy(open_fm_id):
    streamy_openfm = []
    for id in open_fm_id:
        api = f"https://open.fm/api/user/token?fp=https://stream-cdn-1.open.fm/OFM{id}/ngrp:standard/playlist.m3u8"
        stream = pozyskaj_z_api(api)
        streamy_openfm.append(stream)
    with open("url.txt", "w") as plik:
        for i in range(4):
            plik.write(f"{streamy_openfm[i]}, 500{i}\n")

# === Część 2: Uruchamianie serwerów strumieniowych ===

def wczytaj_z_pliku(file_path):
    with open("url.txt", 'r') as file:
        return file.read()

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
    streams = wczytaj_z_pliku(file_path)

    for stream in streams:
        app = create_flask_app(stream["url"])
        threading.Thread(
            target=lambda: serve(app, host='0.0.0.0', port=stream["port"], threads=1),
            daemon=True
        ).start()

    print("Serwery strumieniowe uruchomione.")


# === Część 3: Uruchamianie Serwera WWW ===

def create_web_app():
    # Inicjalizacja aplikacji Flask
    app = Flask(__name__, 
                static_url_path='', 
                static_folder='.')
    
    @app.route('/')
    def root():
        return send_from_directory('.', 'index.html')
        
    @app.route('/<path:path>')
    def send_file(path):
        print(f"Żądanie pliku: {path}")
        try:
            return send_from_directory('.', path)
        except Exception as e:
            print(f"Błąd przy wczytywaniu {path}: {e}")
            return f"Error: {str(e)}", 404
            
    # Dodajemy return app
    return app

def run_www_server(port):
    app = create_web_app()
    
    server_thread = threading.Thread(
        target=lambda: serve(
            app, 
            host='0.0.0.0', 
            port=port, 
            threads=8,
            channel_timeout=30
        ),
        daemon=True
    )
    server_thread.start()
    print(f"Serwer WWW działa na porcie {port}")

# === Część 4: Uruchamianie wszystkich serwerów ===

def main():
    try:
        print("=== Generowanie streamów OpenFM ===")
        open_fm_streamy(open_fm_id)

        print("\n=== Uruchamianie serwerów strumieniowych ===")
        run_stream_servers("url.txt")

        print("\n=== Uruchamianie serwera WWW ===")
        run_www_server(80)

        os.system("start http://localhost")

        print("\nWszystkie serwery działają. Naciśnij Enter, aby zakończyć.")
        input()
    except Exception as e:
        print(f"Wystąpił błąd: {e}")
        input("\nNaciśnij Enter, aby zakończyć.")

# Uruchomienie programu
if __name__ == "__main__":
    main()