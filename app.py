import json
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory, abort

# --- Configuration Class ---
class AppConfig:
    """A class to hold application configuration using pathlib."""
    def __init__(self):
        self.root_dir = Path(__file__).parent
        # A separate, fixed directory for all annotation files.
        self.annotation_dir = self.root_dir / "annotations"

# Create a single, global instance of the configuration
config = AppConfig()

# --- Flask App Initialization ---
app = Flask(__name__)

# --- Flask Routes ---
@app.route('/')
def index():
    """Renders the main annotation page."""
    return render_template('index.html')

@app.route('/set_annotation_dir', methods=['POST'])
def set_annotation_dir():
    """Sets the active directory for saving annotations."""
    data = request.get_json()
    path_str = data.get('path')
    if not path_str:
        abort(400, "Path is missing.")
    
    path = Path(path_str)
    if not path.is_dir():
        if not path.parent.is_dir():
            abort(400, "Invalid or non-existent directory path. The parent directory does not exist.")
    
    config.annotation_dir = path
    print(f"Annotation directory changed to: {config.annotation_dir}")
    return jsonify({"success": True, "path": str(path)})

@app.route('/get_properties_config')
def get_properties_config():
    """Serves the default properties configuration file."""
    return send_from_directory(config.root_dir, 'properties_config.json')

@app.route('/annotations/<path:filename>', methods=['GET', 'POST'])
def handle_annotations(filename):
    """Handles annotations using the dynamically set annotation directory."""
    json_path = config.annotation_dir / f"{filename}.json"

    if request.method == 'POST':
        config.annotation_dir.mkdir(parents=True, exist_ok=True)
        data = request.get_json()
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=4)
        return jsonify({"success": True, "message": "Annotations saved."})

    elif request.method == 'GET':
        if json_path.exists():
            with open(json_path, 'r') as f:
                data = json.load(f)
                return jsonify(data)
        else:
            return jsonify([])
            
@app.route('/batch_annotation_status', methods=['POST'])
def batch_annotation_status():
    """
    Checks annotation status against the current annotation directory.
    This version is optimized to read the directory only once.
    """
    data = request.get_json()
    filenames_from_client = data.get('filenames', [])
    status = {}

    try:
        # 1. Get all existing annotation files in one go.
        # We create a set of the base filenames (e.g., 'image1.jpg') for fast lookups.
        # The .stem of 'image1.jpg.json' is 'image1.jpg'.
        existing_annotations = {p.stem for p in config.annotation_dir.glob('*.json')}

        # 2. Check the status for each client file against the set.
        for name in filenames_from_client:
            status[name] = name in existing_annotations

    except Exception as e:
        print(f"Error reading annotation directory: {e}")
        # On error, report all as un-annotated.
        for name in filenames_from_client:
            status[name] = False

    return jsonify(status)


# --- Main Execution ---
if __name__ == '__main__':
    config.annotation_dir.mkdir(parents=True, exist_ok=True)
    print(f"Annotation directory: {config.annotation_dir}")
    app.run(debug=True)