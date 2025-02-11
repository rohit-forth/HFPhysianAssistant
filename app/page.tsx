import { PhysicianAssistant } from '@/components/physician-assistant';

export default function Home() {
  return (
    <div className=" bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="mx-auto px-4 py-8">
        <header className="mb-12 min-h-[calc(100vh-55vh)] text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Physician Assistant
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Advanced speech-to-text transcription for medical professionals.
            Capture your thoughts, notes, and patient interactions with exceptional accuracy.
          </p>
        </header>
        <PhysicianAssistant />
      </div>
    </div>
  );
}