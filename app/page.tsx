"use client";
import { PhysicianAssistant } from "@/components/physician-assistant";
import Visualizer from "./Visualizer";
import { useMicrophone } from "./context/MicrophoneContextProvider";

export default function Home() {
  const { microphone } = useMicrophone();
  return (
    <div className=" bg-gradient-to-b h-[100vh] from-gray-900 to-gray-700 via-blue-900 text-white">
      <div className="mx-auto px-4 py-8">
        <header className="mb-auto  text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-700 bg-clip-text text-transparent">
            Clinical Assistant AI
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto  bg-clip-text ">
            Advanced speech-to-text transcription for medical professionals.
            Capture your thoughts, notes, and patient interactions.
          </p>
          {/* <div>{microphone && <Visualizer microphone={microphone} />}</div> */}
        </header>
        <PhysicianAssistant />
      </div>
    </div>
  );
}
