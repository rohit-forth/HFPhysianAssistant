"use client";

import { toast } from "@/hooks/use-toast";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";

interface MicrophoneContextType {
  microphone: MediaRecorder | null;
  startMicrophone: () => void;
  stopMicrophone: () => void;
  pauseMicrophone: () => void;
  resumeMicrophone: () => void;
  setupMicrophone: () => Promise<void>;
  microphoneState: MicrophoneState;
  stream: MediaStream | null;
}

export enum MicrophoneEvents {
  DataAvailable = "dataavailable",
  Error = "error",
  Pause = "pause",
  Resume = "resume",
  Start = "start",
  Stop = "stop",
}

export enum MicrophoneState {
  NotSetup = -1,
  SettingUp = 0,
  Ready = 1,
  Recording = 2,
  Paused = 3,
  Error = 4,
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(
  undefined
);

interface MicrophoneContextProviderProps {
  children: ReactNode;
}

const MicrophoneContextProvider: React.FC<MicrophoneContextProviderProps> = ({
  children,
}) => {
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(
    MicrophoneState.NotSetup
  );
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const setupMicrophone = async () => {
    try {
      setMicrophoneState(MicrophoneState.SettingUp);

      // Stop any existing streams
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const userMedia = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        },
      });

      const newMicrophone = new MediaRecorder(userMedia);

      setStream(userMedia);
      setMicrophone(newMicrophone);
      setMicrophoneState(MicrophoneState.Ready);
    } catch (err: any) {
      console.error("Microphone setup error:", err);
      setMicrophoneState(MicrophoneState.Error);
      toast({
        title: "Error",
        description: "Failed to set up microphone. Please check permissions.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const startMicrophone = useCallback(() => {
    if (microphone && microphone.state !== "recording") {
      try {
        microphone.start(250);
        setMicrophoneState(MicrophoneState.Recording);
      } catch (err) {
        console.error("Error starting microphone:", err);
        setMicrophoneState(MicrophoneState.Error);
      }
    }
  }, [microphone]);

  const stopMicrophone = useCallback(() => {
    if (microphone && microphone.state !== "inactive") {
      try {
        microphone.stop();
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        setMicrophoneState(MicrophoneState.NotSetup);
      } catch (err) {
        console.error("Error stopping microphone:", err);
      }
    }
  }, [microphone, stream]);

  const pauseMicrophone = useCallback(() => {
    if (microphone && microphone.state === "recording") {
      try {
        microphone.pause();
        setMicrophoneState(MicrophoneState.Paused);
      } catch (err) {
        console.error("Error pausing microphone:", err);
      }
    }
  }, [microphone]);

  const resumeMicrophone = useCallback(() => {
    if (microphone && microphone.state === "paused") {
      try {
        microphone.resume();
        setMicrophoneState(MicrophoneState.Recording);
      } catch (err) {
        console.error("Error resuming microphone:", err);
      }
    }
  }, [microphone]);

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        startMicrophone,
        stopMicrophone,
        pauseMicrophone,
        resumeMicrophone,
        setupMicrophone,
        microphoneState,
        stream,
      }}
    >
      {children}
    </MicrophoneContext.Provider>
  );
};

function useMicrophone(): MicrophoneContextType {
  const context = useContext(MicrophoneContext);
  if (context === undefined) {
    throw new Error(
      "useMicrophone must be used within a MicrophoneContextProvider"
    );
  }
  return context;
}

export { MicrophoneContextProvider, useMicrophone };
