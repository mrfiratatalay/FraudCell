import sys
from pathlib import Path

# generate_data.py lives next to train.py, outside the app package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
