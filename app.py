import os
import json
from flask import Flask, render_template, request, jsonify, send_from_directory

# --- Configuration Class ---
class AppConfig:
    """A class to hold application configuration."""
    def __init__(self):
        self.root_dir = os.path.dirname(os.path.abspath(__file__))
        # A single, fixed directory for all annotation files.
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

@app.route('/get_properties_config')
def get_properties_config():
    """Serves the properties configuration file from the root directory."""
    return send_from_directory(config.root_dir, 'properties_config.json')

@app.route('/annotations/<path:filename>', methods=['GET', 'POST'])
def handle_annotations(filename):
    """
    Handles annotations using the central annotation directory.
    The filename is provided by the client from its file list.
    """
    json_filename = filename + '.json'
    json_filepath = os.path.join(config.annotation_dir, json_filename)

    if request.method == 'POST':
        # Ensure the annotation directory exists before saving
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
    """
    Receives a list of filenames from the client and returns their annotation status.
    """
    data = request.get_json()
    filenames = data.get('filenames', [])
    status = {}
    for name in filenames:
        annotation_path = os.path.join(config.annotation_dir, name + '.json')
        status[name] = os.path.exists(annotation_path)
    return jsonify(status)


# --- Main Execution ---
if __name__ == '__main__':
    # Create the default annotation directory if it doesn't exist on startup
    os.makedirs(config.annotation_dir, exist_ok=True)
    print(f"Annotation directory: {config.annotation_dir}")
    app.run(debug=True)