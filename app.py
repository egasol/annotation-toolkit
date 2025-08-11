import os
import json
from flask import Flask, render_template, request, jsonify, send_from_directory, abort

# --- Configuration Class ---
class AppConfig:
    """A class to hold application configuration."""
    def __init__(self):
        self.root_dir = os.path.dirname(os.path.abspath(__file__))
        self.annotation_dir = os.path.join(self.root_dir, "annotations")

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
    """
    Sets the active directory for saving annotations.
    SECURITY WARNING: For local use only. Allows the client to specify a write path.
    """
    data = request.get_json()
    path = data.get('path')
    if not path:
        abort(400, "Path is missing.")
    
    # Check if the path exists and is a directory, or if its parent exists.
    if not os.path.isdir(path):
        parent_dir = os.path.dirname(path)
        if not os.path.isdir(parent_dir):
            abort(400, "Invalid or non-existent directory path. The parent directory does not exist.")
        # If parent exists, we can create the directory later.
    
    config.annotation_dir = path
    print(f"Annotation directory changed to: {config.annotation_dir}")
    return jsonify({"success": True, "path": path})

@app.route('/get_properties_config')
def get_properties_config():
    """Serves the default properties configuration file."""
    return send_from_directory(config.root_dir, 'properties_config.json')

@app.route('/annotations/<path:filename>', methods=['GET', 'POST'])
def handle_annotations(filename):
    """Handles annotations using the dynamically set annotation directory."""
    json_filename = filename + '.json'
    json_filepath = os.path.join(config.annotation_dir, json_filename)

    if request.method == 'POST':
        os.makedirs(config.annotation_dir, exist_ok=True)
        data = request.get_json()
        with open(json_filepath, 'w') as f:
            json.dump(data, f, indent=4)
        return jsonify({"success": True, "message": "Annotations saved."})

    elif request.method == 'GET':
        if os.path.exists(json_filepath):
            with open(json_filepath, 'r') as f:
                data = json.load(f)
                return jsonify(data)
        else:
            return jsonify([])
            
@app.route('/batch_annotation_status', methods=['POST'])
def batch_annotation_status():
    """Checks annotation status against the current annotation directory."""
    data = request.get_json()
    filenames = data.get('filenames', [])
    status = {}
    for name in filenames:
        annotation_path = os.path.join(config.annotation_dir, name + '.json')
        status[name] = os.path.exists(annotation_path)
    return jsonify(status)

# --- Main Execution ---
if __name__ == '__main__':
    os.makedirs(config.annotation_dir, exist_ok=True)
    print(f"Default annotation directory: {config.annotation_dir}")
    app.run(debug=True)