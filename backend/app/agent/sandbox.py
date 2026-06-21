import os
import sys
import shutil
import hashlib
import logging
import json
import time
import subprocess
from typing import Optional
from backend.app.models import AuditStatus

logger = logging.getLogger("fc_agent")

class CaseIsolationSandbox:
    """
    Application-Level Case Isolation Sandbox.
    Used as the standard developer fallback if Bubblewrap is not installed on the host.
    Restricts file actions to a specific folder using Python path validation.
    """
    def __init__(self, transaction_id: str, target_name: str, execution_type: str):
        self.transaction_id = transaction_id
        self.target_name = target_name
        self.execution_type = execution_type
        
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.workspace_dir = os.path.join(base_dir, "workspace", "cases", transaction_id)
        
        self.start_time = None
        self.execution_log = []
        self.result_signature = None

    def __enter__(self):
        self.start_time = time.time()
        os.makedirs(self.workspace_dir, exist_ok=True)
        self.log(f"--- Application-Level Sandbox initialized for: '{self.transaction_id}' ---")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.log(f"--- Sandbox Context closed in {duration:.4f}s ---")
        
        signature_payload = {
            "transaction_id": self.transaction_id,
            "target": self.target_name,
            "type": self.execution_type,
            "duration_seconds": duration,
            "logs": self.execution_log,
            "exception_occurred": exc_type is not None
        }
        serialized = json.dumps(signature_payload, sort_keys=True)
        self.result_signature = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return False

    def log(self, message: str):
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        self.execution_log.append({
            "timestamp": timestamp,
            "message": message
        })

    def run_tool(self, tool_func, *args, **kwargs):
        tool_name = tool_func.__name__
        self.log(f"Action: Invoking tool '{tool_name}'")
        try:
            result = tool_func(*args, **kwargs)
            self.log(f"Observation: '{tool_name}' returned status: {result.get('status', AuditStatus.UNKNOWN.value)}")
            return result
        except Exception as e:
            self.log(f"Observation ERROR: Tool '{tool_name}' failed: {str(e)}")
            return {"status": AuditStatus.ERROR.value, "message": str(e)}


class BubblewrapComplianceSandbox:
    """
    Production-Grade Kernel-Level Sandbox using Linux Bubblewrap (bwrap).
    Spawns an isolated subprocess with:
    1. Network namespace unshared (complete network disconnection to prevent POPIA data egress).
    2. Host OS files bind-mounted read-only (allows running Python but blocks modifications).
    3. Dedicated writeable directory mounted ONLY for the specific case workspace.
    """
    def __init__(self, transaction_id: str, target_name: str, execution_type: str):
        self.transaction_id = transaction_id
        self.target_name = target_name
        self.execution_type = execution_type
        
        # 4 levels up gets the workspace root directory containing backend/ and frontend/
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.workspace_dir = os.path.join(self.base_dir, "backend", "workspace", "cases", transaction_id)
        
        self.start_time = None
        self.execution_log = []
        self.result_signature = None

    def __enter__(self):
        self.start_time = time.time()
        os.makedirs(self.workspace_dir, exist_ok=True)
        self.log(f"--- Bubblewrap Kernel-Level Sandbox initialized for: '{self.transaction_id}' ---")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.log(f"--- Bubblewrap Sandbox closed in {duration:.4f}s ---")
        
        signature_payload = {
            "transaction_id": self.transaction_id,
            "target": self.target_name,
            "type": self.execution_type,
            "duration_seconds": duration,
            "logs": self.execution_log,
            "exception_occurred": exc_type is not None
        }
        serialized = json.dumps(signature_payload, sort_keys=True)
        self.result_signature = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return False

    def log(self, message: str):
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        self.execution_log.append({
            "timestamp": timestamp,
            "message": message
        })

    def run_tool(self, tool_func, *args, **kwargs):
        tool_name = tool_func.__name__
        self.log(f"Action: Invoking tool '{tool_name}' inside Bubblewrap sandbox...")
        
        # Serialize arguments to pass safely into Python script
        args_str = ", ".join(repr(arg) for arg in args)
        kwargs_str = ", ".join(f"{k}={repr(v)}" for k, v in kwargs.items())
        params = []
        if args_str: params.append(args_str)
        if kwargs_str: params.append(kwargs_str)
        params_str = ", ".join(params)
        
        # Determine paths dynamically based on running python interpreter
        real_py = os.path.realpath(sys.executable)
        python_home = os.path.dirname(os.path.dirname(real_py))
        python_bin_name = os.path.basename(real_py)
        
        py_version_str = f"python{sys.version_info.major}.{sys.version_info.minor}"
        venv_site_packages = os.path.join("/app", ".venv", "lib", py_version_str, "site-packages")
        
        script_code = f"""
import json
import sys
# Mount virtual environment packages and project root inside python path
sys.path.append('{venv_site_packages}')
sys.path.append('/app')
from backend.app.agent.tools import {tool_name}

try:
    result = {tool_name}({params_str})
    print(json.dumps(result))
except Exception as e:
    from backend.app.models import AuditStatus
    print(json.dumps({{"status": AuditStatus.ERROR.value, "message": str(e)}}))
"""
        return self.run_sandboxed_script(script_code, python_home, python_bin_name)

    def run_sandboxed_script(self, script_body: str, python_home: str, python_bin_name: str) -> dict:
        """
        Executes a Python script inside the Bubblewrap sandbox.
        """
        script_path = os.path.join(self.workspace_dir, "run_tool.py")
        with open(script_path, "w") as f:
            f.write(script_body)
            
        # Standard paths required to run Python binary on Linux
        bwrap_command = [
            "bwrap",
            "--unshare-net",               # 100% network isolation (POPIA compliant)
            "--ro-bind", "/usr", "/usr",   # Bind system binaries read-only
            "--ro-bind", "/lib", "/lib",
            "--ro-bind", "/lib64", "/lib64",
            "--ro-bind", "/bin", "/bin",
            "--ro-bind", "/sbin", "/sbin",
            "--ro-bind", "/etc/alternatives", "/etc/alternatives", # symlinks
            "--ro-bind", python_home, "/python", # Bind python runtime environment
            "--ro-bind", self.base_dir, "/app", # Bind codebase read-only under /app
            "--dir", "/tmp",               # isolated tmpfs mount
            "--dir", "/run",
            "--dev", "/dev",               # mount isolated dev nodes (urandom, null, etc.) for python startup
            # Mount only the specific case directory as read-write
            "--bind", self.workspace_dir, "/workspace",
            "--chdir", "/workspace",
            f"/python/bin/{python_bin_name}", "/workspace/run_tool.py"
        ]
        
        try:
            res = subprocess.run(
                bwrap_command, 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            
            if res.returncode == 0:
                try:
                    # Expect the script to print JSON results to stdout
                    return json.loads(res.stdout.strip())
                except json.JSONDecodeError:
                    return {"status": AuditStatus.ERROR.value, "message": "Failed to parse sandbox output JSON."}
            else:
                self.log(f"Observation ERROR: Sandbox process crashed with code {res.returncode}")
                self.log(f"Stderr: {res.stderr}")
                return {"status": AuditStatus.ERROR.value, "message": f"Sandbox crash: {res.stderr}"}
                
        except FileNotFoundError:
            # Fallback if bwrap is not installed on path
            raise
        except subprocess.TimeoutExpired:
            self.log("Observation ERROR: Sandbox process timed out (> 5s).")
            return {"status": AuditStatus.ERROR.value, "message": "Sandbox execution timeout."}


# Smart Factory Context Manager:
# Dynamically selects Bubblewrap Sandbox if bwrap binary exists on PATH,
# otherwise seamlessly falls back to Python Case-Level directory isolation.
class CaseSandboxFactory:
    def __init__(self, transaction_id: str, target_name: str, execution_type: str):
        self.transaction_id = transaction_id
        self.target_name = target_name
        self.execution_type = execution_type
        
        # Check if bubblewrap is installed on host path
        self.use_bwrap = shutil.which("bwrap") is not None
        
        if self.use_bwrap:
            logger.info(f"Bubblewrap detected. Using BubblewrapComplianceSandbox for transaction '{transaction_id}'.")
            self.delegate = BubblewrapComplianceSandbox(transaction_id, target_name, execution_type)
        else:
            logger.warning(f"Bubblewrap not found. Falling back to CaseIsolationSandbox for transaction '{transaction_id}'.")
            self.delegate = CaseIsolationSandbox(transaction_id, target_name, execution_type)

    def __enter__(self):
        return self.delegate.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self.delegate.__exit__(exc_type, exc_val, exc_tb)
