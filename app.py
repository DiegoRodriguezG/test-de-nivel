from flask import Flask, request, jsonify, render_template
import openai, os
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)
openai.api_key = os.getenv("OPENAI_API_KEY")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    completion = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": data["message"]}]
    )
    return jsonify({"reply": completion.choices[0].message["content"]})

@app.route("/tts", methods=["POST"])
def tts():
    data = request.json
    audio = openai.Audio.create(
        model="tts-1",
        voice="nova",
        input=data["text"]
    )
    return audio.content, 200, {'Content-Type': 'audio/mpeg'}
