import argparse
import os
import subprocess
import sys
from pathlib import Path


def run_command(cmd, cwd=None, env=None, check=True):
    print(f"Uruchamianie: {' '.join(cmd)} w {cwd}")
    subprocess.run(cmd, cwd=cwd, env=env, check=check)


def run_compose(directory: Path, compose_file="docker-compose.yml", build=False):
    command = ["docker-compose", "-f", compose_file, "up", "-d"]
    if build:
        command.insert(3, "--build")
    run_command(command, cwd=directory)
    print(f"Pomyślnie uruchomiono docker-compose w {directory}")


def create_venv(venv_dir: Path):
    if venv_dir.exists():
        print(f"Wirtualne środowisko już istnieje: {venv_dir}")
        return
    run_command([sys.executable, "-m", "venv", str(venv_dir)])
    print(f"Utworzono venv w {venv_dir}")


def get_venv_python(venv_dir: Path) -> str:
    if sys.platform == "win32":
        return str(venv_dir / "Scripts" / "python.exe")
    return str(venv_dir / "bin" / "python")


def install_requirements(python_exe: str, requirements_file: Path):
    if not requirements_file.exists():
        raise FileNotFoundError(f"Brak pliku requirements: {requirements_file}")
    run_command([python_exe, "-m", "pip", "install", "-r", str(requirements_file)])
    print("Zainstalowano zależności w venv")


def start_background_process(python_exe: str, script_path: Path, log_path: Path | None, env: dict | None = None):
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        stdout = open(log_path, "a", encoding="utf-8")
        stderr = stdout
    else:
        stdout = None
        stderr = None
    process = subprocess.Popen(
        [python_exe, str(script_path)],
        cwd=script_path.parent,
        stdout=stdout,
        stderr=stderr,
        env=env,
    )
    print(f"Uruchomiono {script_path.name} jako PID {process.pid}, logi: {log_path}")
    return process


def parse_args():
    parser = argparse.ArgumentParser(description="Uruchomienie symulatora, pollera i aplikacji lokalnie")
    parser.add_argument("--build", action="store_true", help="Buduje obrazy Docker przed startem")
    parser.add_argument("--no-docker", action="store_true", help="Pomija uruchamianie docker-compose")
    parser.add_argument("--no-apps", action="store_true", help="Pomija uruchamianie main.py i api.py")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    root_dir = Path(__file__).resolve().parent

    simulator_dir = root_dir / "simulator"
    poller_dir = root_dir / "poller"
    venv_dir = poller_dir / "venv"
    api_log = poller_dir / "api.log"

    if not args.no_docker:
        run_compose(simulator_dir, build=args.build)
        run_compose(poller_dir, build=args.build)

    create_venv(venv_dir)
    python_exe = get_venv_python(venv_dir)
    install_requirements(python_exe, poller_dir / "requirements.txt")

    if not args.no_apps:
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONPATH"] = str(poller_dir)

        start_background_process(python_exe, poller_dir / "api.py", api_log, env=env)

    print("Gotowe. Użyj `tail -f poller/api.log` aby przeglądać API logi.")
