from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
import os
import subprocess
import json
import tempfile
from pydantic import BaseModel, Field
import traceback

load_dotenv()

# Middleware para manejar el prefijo /testdenivel
class PrefixMiddleware:
    def __init__(self, app, prefix=''):
        self.app = app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        if environ['PATH_INFO'].startswith(self.prefix):
            environ['PATH_INFO'] = environ['PATH_INFO'][len(self.prefix):]
            environ['SCRIPT_NAME'] = self.prefix
        return self.app(environ, start_response)

app = Flask(__name__)
app.wsgi_app = PrefixMiddleware(app.wsgi_app, prefix='/testdenivel')
CORS(app)
client = OpenAI()

CHAR_LIMIT = 3000  # Límite de caracteres por prompt

# 👇 Modelo estructurado para respuesta de evaluación
class Observacion(BaseModel):
    tipo: str  # "fortaleza" o "consejo"
    texto: str

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
                model="gpt-4o-mini-transcribe",
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

class DistribucionCEFR(BaseModel):
    A1: int
    A2: int
    B1: int
    B2: int
    C1: int

    def suma_valida(self) -> bool:
        return sum(self.dict().values()) == 100

class EvaluacionFinal(BaseModel):
    nivel: str
    mensaje: str
    observaciones: list[Observacion]

class TurnoEvaluado(BaseModel):
    reply: str = Field(..., description="Pregunta generada para el usuario")
    Q: float = Field(..., description="Calidad informativa (de 0 a 1)")
    P_nueva: DistribucionCEFR

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        prompt = data["message"][:CHAR_LIMIT]
        print("💬 Prompt recibido:\n", prompt)

        completion = client.beta.chat.completions.parse(
            model="gpt-5-nano",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres una entrevistadora especializada en evaluación oral de idiomas mediante una conversación breve y natural.\n\n"
                        "Rol:\n"
                        "- Habla SIEMPRE en el idioma objetivo indicado en el mensaje de usuario.\n"
                        "- Genera solo UNA intervención corta con UNA pregunta clara.\n"
                        "- Adapta la dificultad de tu intervención al nivel CEFR estimado que se pasa en el mensaje de usuario.\n"
                        "- Usa el tema/situación, historial reciente y último mensaje para dar fluidez y NO repetir preguntas. Pero NO te quedes pegado, amplía la conversación\n\n"
                        "Evaluación:\n"
                        "- Evalúa SOLO la última respuesta del usuario.\n"
                        "- Calcula Q ∈ [0,1], la calidad de información que aporta SOLO la última respuesta para estimar el nivel de idioma :\n"
                        "  • Q ≤ 0.3 → respuesta con información casi nula para evaluar nivel (muy corta, genérica, memorizada, evasiva).\n"
                        "  • 0.4 < Q < 0.7 → respuesta con algo de información, pero limitada o desarrollo).\n"
                        "  • Q ≥ 0.7 → respuesta suficientemente rica: clara, con contenido real, suficiente para extraer evidencias de nivel\n"
                        "- Calcula P_nueva = distribución CEFR (A1–C1) que refleje SOLO esta última respuesta.\n"
                        "  • Siempre suma 100 con valores enteros.\n"
                        "  • Respuesta con muchos errores o sin sentido → peso en A1"
                        "  • Respuesta muy básica, con vocabulario limitado, algunos errores o frases sueltas → peso en A1/A2.\n"
                        "  • Respuesta con ideas completas y control básico → peso en A2/B1.\n"
                        "  • Respuesta con fluidez y conectores → peso en B1/B2.\n"
                        "  • Respuesta con estructuras avanzadas, matiz y precisión → peso en B2/C1.\n"
                        "  • Respuesta con gran dominio del idioma → peso en C1.\n"
                        "Si es la primera respuesta del usuario dale Q = 0"
                        "Si no es la primera respuesta del usuarios y Q ≤ 0.4, antes de tu pregunta incluye un consejo breve y empático en español (máx. 1 línea).\n\n"
                        "Formato JSON estricto (sin texto extra):\n"
                        "{\n"
                        '  "reply": "tu próxima intervención en el idioma objetivo",\n'
                        '  "Q": número entre 0 y 1,\n'
                        '  "P_nueva": { "A1": %, "A2": %, "B1": %, "B2": %, "C1": % }\n'
                        "}"
                    )
                },
                {"role": "user", "content": prompt}
            ],
            response_format=TurnoEvaluado
        )

        parsed = completion.choices[0].message.parsed

        if not parsed.P_nueva.suma_valida():
            raise ValueError("❌ La distribución CEFR no suma 100.")

        print("✅ JSON estructurado recibido:", parsed)
        return jsonify(parsed.dict())


    except Exception as e:
        print("❌ Error en /chat:", e)
        traceback.print_exc()  # 👈 esto te da el stack completo
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
    try:
        data = request.json
        print("📊 Recibiendo historial para evaluación final...")

        messages = [
            {
                "role": "system",
                "content": (
                   "Eres un evaluador profesional de nivel de inglés. Basado en el historial completo de conversación entre un candidato y una entrevistadora, entrega una evaluación final clara, en español, usando este formato JSON:\n\n"
                    "{\n"
                    "  \"nivel\": \"B1 - Intermedio\",\n"
                    "  \"mensaje\": \"Mensaje resumen empático y directo (máx 1 frase)\",\n"
                    "  \"observaciones\": [\n"
                    "    { \"tipo\": \"fortaleza\", \"texto\": \"...\" },\n"
                    "    { \"tipo\": \"fortaleza\", \"texto\": \"...\" },\n"
                    "    { \"tipo\": \"consejo\", \"texto\": \"...\" },\n"
                    "    { \"tipo\": \"consejo\", \"texto\": \"...\" }\n"
                    "  ]\n"
                    "}\n\n"
                    "Evalúa con justicia. Si el usuario mostró frases muy básicas, errores constantes o respuestas muy cortas, puedes asignar A1.\n"
                    "Si respondió con fluidez y estructuras avanzadas, puedes asignar C1.\n"
                    "Si respondió poco, o con baja calidad, igualmente debes entregar un diagnóstico y consejos.\n\n"
                    "Las observaciones deben ser útiles, breves (máx 150 caracteres), y basadas en fragmentos reales de la conversación.\n"
                    "Usa un tono amable, profesional y constructivo. No incluyas explicaciones fuera del JSON."
                )
            },
            {
                "role": "user",
                "content": f"Este es el historial completo:\n\n{json.dumps(data['historial'], indent=2)}"
            }
        ]

        completion = client.beta.chat.completions.parse(
            model="gpt-5-mini",
            messages=messages,
            response_format=EvaluacionFinal,
        )

        parsed = completion.choices[0].message.parsed

        return jsonify(parsed.dict())

    except Exception as e:
        print("❌ Error en /evaluate:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("🚀 Servidor iniciado en modo debug")
    app.run(debug=True)
