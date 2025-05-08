from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
import os
import subprocess
import json
import tempfile
from pydantic import BaseModel

load_dotenv()
app = Flask(__name__)
CORS(app)
client = OpenAI()

CHAR_LIMIT = 3000  # Límite de caracteres por prompt

# 👇 Modelo estructurado para respuesta de evaluación
class Observacion(BaseModel):
    tipo: str  # "fortaleza" o "consejo"
    texto: str

class EvaluacionFinal(BaseModel):
    nivel: str
    mensaje: str
    observaciones: list[Observacion]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        audio_file = request.files["file"]
        print("📥 Archivo recibido:", audio_file.filename)

        # Crear archivos temporales únicos
        in_temp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
        out_temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)

        input_path = in_temp.name
        output_path = out_temp.name

        audio_file.save(input_path)
        print("📁 Guardado en:", input_path)

        # Convertir a WAV, limitado a 35s si querés mantener ese tope
        print("🔄 Ejecutando ffmpeg...")
        subprocess.run(["ffmpeg", "-y", "-t", "35", "-i", input_path, output_path], check=True)
        print("✅ Conversión completada:", output_path)

        # Enviar a Whisper API de OpenAI
        print("📤 Enviando a OpenAI para transcripción...")
        with open(output_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=f
            )

        print("📝 Transcripción:", transcription.text)

        return jsonify({
            "text": transcription.text
        })

    except Exception as e:
        print("❌ Error en /transcribe:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        # Borrar archivos temporales si existen
        for path in [input_path, output_path]:
            try:
                os.remove(path)
                print(f"🧹 Archivo temporal eliminado: {path}")
            except Exception as err:
                print(f"⚠️ No se pudo borrar {path}:", err)

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        prompt = data["message"][:CHAR_LIMIT]  # Truncar si es necesario
        print("💬 Usuario:", prompt)

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "interview_reply",
                    "description": "Response from Anastasia, the interviewer.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "output": {
                                "type": "string",
                                "description": "What Anastasia will say to the user."
                            },
                            "info_value": {
                                "type": "integer",
                                "description": "A score from 1 to 5 indicating how informative the user's last response is."
                            }
                        },
                        "required": ["output", "info_value"]
                    }
                }
            }
        ]

        completion = client.chat.completions.create(
            model="gpt-4.1-mini-2025-04-14",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Anastasia, a professional interviewer simulating a job interview in English. "
                        "You can ask questions, request clarification, or make comments. "
                        "Also rate the user's last answer from 1 to 5 as 'info_value' based on how useful it is for evaluating their English. "
                        "Always respond using the 'interview_reply' function."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "interview_reply"}}
        )

        tool_call = completion.choices[0].message.tool_calls[0]
        args = json.loads(tool_call.function.arguments)

        print("🤖 GPT responde:", args)

        return jsonify({
            "reply": args["output"],
            "info_value": args["info_value"]
        })

    except Exception as e:
        print("❌ Error en /chat:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/tts", methods=["POST"])
def tts():
    try:
        data = request.json
        print("🔣 TTS input:", data["text"])

        audio = client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=data["text"]
        )

        print("🔊 Audio TTS generado")
        return audio.content, 200, {"Content-Type": "audio/mpeg"}

    except Exception as e:
        print("❌ Error en /tts:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/evaluate", methods=["POST"])
def evaluate():
    print("🛬 Recibido POST /evaluate")
    raw = request.data
    print("📦 Raw body recibido:", raw)

    try:
        data = request.json

        print("✅ JSON decodificado:", data)

        historial = data.get("historial", [])
        print("🧠 Historial decodificado:", historial)

        messages = [
            {
                "role": "system",
                "content": (
                    "Eres un evaluador profesional de nivel de inglés. Basado en el historial completo de conversación entre un candidato y una entrevistadora, "
                    "entrega una evaluación estructurada en español, usando solo un mensaje de aliento/resumen y una lista de observaciones. Háblale directo al candidato. Cada observación debe ser breve, amable, útil y con ejemplos concretos de la conversación.\n\n"
                    "Usa este formato JSON de ejemplo:\n"
                    "{\n"
                    "  \"nivel\": \"B1 - Intermedio\",\n"
                    "  \"mensaje\": \"Tu nivel te permite comunicarte con confianza en la mayoría de contextos laborales.\",\n"
                    "  \"observaciones\": [\n"
                    "    { \"tipo\": \"fortaleza\", \"texto\": \"Mantuviste fluidez al responder preguntas abiertas y sin usar muletillas.\" },\n"
                    "    { \"tipo\": \"consejo\", \"texto\": \"Practica tiempos verbales en pasado como ‘I used to...’ o ‘I struggled with...’\" }\n"
                    "  ]\n"
                    "}\n\n"
                    "Usa un tono amable y profesional. Exactamente 2 fortalezas y 2 consejos, en orden. Max 150 car. cada una. No incluyas explicaciones fuera del JSON."
                )
            },
            {
                "role": "user",
                "content": f"Este es el historial completo:\n\n{json.dumps(data['historial'], indent=2)}"
            }
        ]

        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )

        raw_content = completion.choices[0].message.content
        parsed_dict = json.loads(raw_content)
        parsed = EvaluacionFinal.model_validate(parsed_dict)

        return jsonify(parsed.dict())

    except Exception as e:
        print("❌ Error en /evaluate:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("🚀 Servidor iniciado en modo debug")
    app.run(debug=True)
