import os
import subprocess
import sys
from pathlib import Path
import logging

# 1. Konfiguracja podstawowa (odpowiednik domyślnego zachowania loguru)
logging.basicConfig(
    level=logging.INFO,  # Poziom logowania (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s | %(levelname)-8s | %(filename)s:%(lineno)d - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout)  # Wypisywanie do konsoli
    ]
)

# 2. Utworzenie instancji loggera
logger = logging.getLogger("MonitoringTool")

def run_command(cmd, cwd=None, env=None, check=True):
    if cwd is not None:
        logger.info(f"Executing: {' '.join(cmd)} in {cwd}")
    else:
        logger.info(f"Executing: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, env=env, check=check)


def run_compose(directory: Path, compose_file="docker-compose.yml", build=False):
    command = ["docker-compose", "-f", compose_file, "up", "-d"]
    if build:
        command.insert(3, "--build")
    run_command(command, cwd=directory)
    logger.info(f"Sucessfully executed docker-compose in {directory}")


def create_venv(venv_dir: Path):
    if venv_dir.exists():
        logger.info(f"Virtual Env already exists: {venv_dir}")
        return
    run_command([sys.executable, "-m", "venv", str(venv_dir)])
    logger.info(f"Created venv in {venv_dir}")


def get_venv_python(venv_dir: Path) -> str:
    if sys.platform == "win32":
        return str(venv_dir / "Scripts" / "python.exe")
    return str(venv_dir / "bin" / "python")


def install_requirements(python_exe: str, requirements_file: Path):
    if not requirements_file.exists():
        raise FileNotFoundError(f"missing requirments file: {requirements_file}")
    run_command([python_exe, "-m", "pip", "install", "-r", str(requirements_file)])
    logger.info("Dependencies have been installed in venv")


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
    return process


if __name__ == "__main__":
    root_dir = Path(__file__).resolve().parent

    simulator_dir = root_dir / "simulator"
    poller_dir = root_dir / "poller"
    venv_dir = poller_dir / "venv"
    api_log = poller_dir / "api.log"

    run_compose(simulator_dir, build=False)
    run_compose(poller_dir, build=False)
    
    create_venv(venv_dir)
    python_exe = get_venv_python(venv_dir)
    install_requirements(python_exe, poller_dir / "requirements.txt")


    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONPATH"] = str(poller_dir)

    api_process = start_background_process(python_exe, poller_dir / "api.py", api_log, env=env)
    poller_process = start_background_process(python_exe, poller_dir / "main.py", None, env=env)

    try:
        api_process.wait()
        poller_process.wait()
    except KeyboardInterrupt:
        api_process.terminate()
        poller_process.terminate()
            
        logger.info("Stopping Docker containers...")
        subprocess.run(["docker-compose", "down"], cwd=simulator_dir, capture_output=True)
        subprocess.run(["docker-compose", "down"], cwd=poller_dir, capture_output=True)
                
        logger.info("Application has been stopped")
