import { useEffect, useRef, useState } from "react";

export function useStreamingSTT() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startRecording = async () => {
    if (isRecording) return;
    try {
      window.electronAPI.stt.start();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 }
      });
      console.log("stream", stream)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      console.log("audioContext", audioContext)
      const source = audioContext.createMediaStreamSource(stream);
      console.log("source", source)
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      console.log("processor", processor)

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const buffer = new Int16Array(input.length);

        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]));
          buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        window.electronAPI.stt.sendChunk(buffer.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      processorRef.current = processor;

      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    try {
      processorRef.current?.disconnect();
      await audioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());

      window.electronAPI.stt.stop();
      setIsRecording(false);
    } catch (error) {
      console.log("error in stop recording", error)
    }
  };

  useEffect(() => {
    window.electronAPI.stt.onResult((text) => {
      console.log("Transcript:", text);
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}
