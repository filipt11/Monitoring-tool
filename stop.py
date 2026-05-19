import subprocess
import os
import sys

def stop_compose(directory, compose_file="docker-compose.yml"):
    """Uruchamia docker-compose w podanym katalogu."""
    try:
        os.chdir(directory)
        cmd = ["docker-compose", "-f", compose_file, "down"]
        print(f"Uruchamianie: {' '.join(cmd)} w {directory}")
        subprocess.run(cmd, check=True)
        print(f"Pomyślnie uruchomiono w {directory}")
    except subprocess.CalledProcessError as e:
        print(f"Błąd podczas uruchamiania w {directory}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    poller_dir = os.path.join(base_dir, "poller")
    stop_compose(poller_dir)
    
    simulator_dir = os.path.join(base_dir, "simulator")
    stop_compose(simulator_dir)
    
    print("Wszystkie usługi zostały uruchomione!")