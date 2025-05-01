const startBtn = document.getElementById("start");
const chat = document.getElementById("chat");
const audioPlayer = document.getElementById("respuesta-audio");

let chunks = [];

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  recorder.start();
  startBtn.textContent = "🎙️ Grabando...";

  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    chunks = [];

    const formData = new FormData();
    formData.append("file", blob);
    formData.append("model", "whisper-1");

    const transcription = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: "Bearer TU_API_KEY" // TEMPORAL para test local
      },
      body: formData
    }).then(res => res.json());

    const message = transcription.text;
    chat.innerHTML += `<p><strong>Tú:</strong> ${message}</p>`;

    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    const reply = data.reply;
    chat.innerHTML += `<p><strong>Bot:</strong> ${reply}</p>`;

    const audioRes = await fetch("/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: reply })
    });
    const audioBlob = await audioRes.blob();
    audioPlayer.src = URL.createObjectURL(audioBlob);
  };

  setTimeout(() => {
    recorder.stop();
    startBtn.textContent = "🎤 Hablar";
  }, 5000);
};
