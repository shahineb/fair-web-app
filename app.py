import os
import time
import ast
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS, cross_origin
import threading
from threading import Thread
from src.run_fair import initialise_fair, run, DEFAULT_ESMs, get_ebm_configs
from http.server import HTTPServer, SimpleHTTPRequestHandler

app = Flask(__name__, static_folder="static")
CORS(app)

UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Create folder if it doesn't exist

# Global variables for the two models
other_forcers = 'ssp245'
esms = DEFAULT_ESMs
model_a = None
model_b = None
active_model = "a"  # Indicates which model is currently active
was_used = {"a": False, "b": False}  # Tracks which model has been used
is_ready = {"a": False, "b": False}  # Tracks which model is ready
lock = threading.Lock()


def initialise_models():
    """
    Initialize both models at startup.
    """
    global model_a, model_b, other_forcers, esms
    model_a = initialise_fair(other_forcers, esms)
    model_b = initialise_fair(other_forcers, esms)


def reinitialize_model(model_name):
    """
    Reinitialize the specified model.
    """
    global model_a, model_b, other_forcers, esms
    if model_name == "a":
        model_a = initialise_fair(other_forcers, esms)
    elif model_name == "b":
        model_b = initialise_fair(other_forcers, esms)


def switchmodel():
    global active_model
    if active_model == "a":
        active_model = "b"
    elif active_model == "b":
        active_model = "a"

def daemon_reinitializer():
    """
    Background daemon that reinitializes the inactive model if it has been used.
    """
    while True:
        time.sleep(1)  # Check every 5 seconds
        with lock:
            if was_used["a"]:
                print("Reinitializing Model A...")
                reinitialize_model("a")
                print("Model A ready")
                was_used["a"] = False
            elif was_used["b"]:
                print("Reinitializing Model B...")
                reinitialize_model("b")
                print("Model B ready")
                was_used["b"] = False



# Route for serving static files
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files from the 'static' directory."""
    return send_from_directory(app.static_folder, path)


@app.route('/process', methods=['POST'])
@cross_origin()
def process_csv():
    # # Wait if the model is being reinitialized
    global active_model, was_used, other_forcers, esms

    # Check if a file is part of the request
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)  # Save the uploaded file

    # Get the other forcers value and list of ESMs
    requested_other_forcers = request.form.get('other_forcers', None)
    requested_esms = ast.literal_eval(request.form.get('models', None))
    if (requested_other_forcers != other_forcers) or (set(requested_esms) != set(esms)):
        other_forcers = requested_other_forcers
        esms = requested_esms
        print(f"Reinitializing models with {len(esms)} ESMs")
        print(f"Reinitializing models with other forcers: {other_forcers}")
        initialise_models()

    # Determine the active model
    if active_model == "a":
        fair_model = model_a
    elif active_model == "b":
        fair_model = model_b
    else:
        return jsonify({'error': 'Invalid active model'}), 500
    print(f"Predicting with model {active_model}")

    # Process the CSV
    try:
        df = pd.read_csv(file_path)  # Read the CSV file
        df = df.sort_values(by='year', ascending=True)
        df = df.loc[df['year'] <= 2100]
        df['year'] = df['year'].astype(int)
        df = df.groupby('year')['CO2'].mean().reset_index()

        co2 = df['CO2'].values
        years = df['year'].values
        t, T, Tbar, ECS = run(fair_model, years, co2)

        with lock:
            was_used[active_model] = True
            switchmodel()
            print(f"Switched to Model {active_model}")   

        # Return the result as JSON
        return jsonify({
            'co2': list(Tbar),
            'year': list(t),
            'ensemble': list(map(list, T.T)),
            'ecs': ECS,
            'message': 'File processed successfully! Reinitialization started.'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize the model once before the first request
    initialise_models()
    daemon_thread = threading.Thread(target=daemon_reinitializer, daemon=True)
    daemon_thread.start()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)