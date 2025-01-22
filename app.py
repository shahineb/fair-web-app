from flask import Flask, request, jsonify
import pandas as pd
import os
from flask_cors import CORS
from threading import Thread
from run_fair import initialise_fair, run

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Create folder if it doesn't exist

# Global variable to store the initialized `f`
fair_model = None
initializing = False

def async_initialise_fair():
    """
    Initialize `fair` in a background thread to avoid blocking the application.
    """
    global fair_model, initializing
    initializing = True
    fair_model = initialise_fair()
    initializing = False

@app.route('/process', methods=['POST'])
def process_csv():
    global fair_model, initializing

    # Wait if the model is being reinitialized
    if initializing or fair_model is None:
        return jsonify({'error': 'System is still initializing. Please try again later.'}), 503

    # Check if a file is part of the request
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)  # Save the uploaded file

    # Process the CSV
    try:
        df = pd.read_csv(file_path)  # Read the CSV file
        df = df.sort_values(by='year', ascending=True)
        df = df.loc[df['year'] <= 2100]
        df['year'] = df['year'].astype(int)
        df = df.groupby('year')['CO2'].mean().reset_index()

        co2 = df['CO2'].values
        years = df['year'].values
        t, T, Tbar = run(fair_model, years, co2)

        # Start reinitialization in the background
        thread = Thread(target=async_initialise_fair)
        thread.start()

        # Return the result as JSON
        return jsonify({
            'co2': list(Tbar),
            'year': list(t),
            'message': 'File processed successfully! Reinitialization started.'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize the model once before the first request
    fair_model = initialise_fair()
    app.run(debug=True)