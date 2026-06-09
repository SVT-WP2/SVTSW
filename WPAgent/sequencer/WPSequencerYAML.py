# WPSequencerYAML.py
import yaml
from WPSequencer import WPSequencer


class WPSequencerYAML(WPSequencer):

    def load_sequence(self, filepath):
        """Override to support YAML files; falls back to parent JSON loader."""
        if filepath.endswith((".yaml", ".yml")):
            with open(filepath, "r", encoding="utf-8") as f:
                doc = yaml.safe_load(f)
            self.context = doc.get("params", {})
            self.sequence = doc.get("steps", [])
        else:
            super().load_sequence(filepath)  # existing JSON path untouched

    def run_sequence(self, delay=0.5, overrides=None):
        """Override to inject runtime overrides and handle foreach loops."""
        if overrides:
            self.context.update(overrides)
        return self._run_steps(self.sequence, delay)

    # ------------------------------------------------------------------ #
    # Internal helpers — only used by YAML sequences                       #
    # ------------------------------------------------------------------ #

    def _resolve(self, value):
        """Recursively replace $var with values from self.context."""
        if isinstance(value, str) and value.startswith("$"):
            return self.context.get(value[1:], value)
        if isinstance(value, dict):
            return {k: self._resolve(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._resolve(v) for v in value]
        return value

    def _run_steps(self, steps, delay):
        for step in steps:
            if "foreach" in step:
                items = self._resolve(step["foreach"])
                loop_var = step.get("as", "item")
                for item in items:
                    self.context[loop_var] = item
                    result = self._run_steps(step["steps"], delay)
                    if result and result.get("status") != "success":
                        return result
                continue

            command = step["command"]
            params  = self._resolve(step.get("params", {}))
            result  = self.execute_command(command, params)

            if result.get("status") != "success":
                return result

            import time; time.sleep(delay)

        return {"status": "success"}