"use client";

import {
  createClient,
  LiveClient,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveSchema,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  FunctionComponent,
} from "react";
import { useToast } from "@/hooks/use-toast";

interface DeepgramContextType {
  connection: LiveClient | null;
  connectToDeepgram: (options: LiveSchema, endpoint?: string) => Promise<void>;
  disconnectFromDeepgram: () => void;
  connectionState: LiveConnectionState;
}

const DeepgramContext = createContext<DeepgramContextType | undefined>(
  undefined
);

interface DeepgramContextProviderProps {
  children: ReactNode;
}

const getApiKey = async (): Promise<string> => {
  try {
    const response = await fetch("/api/authenticate", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.key) {
      throw new Error("No API key received");
    }

    return result.key;
  } catch (error) {
    console.error("Error fetching API key:", error);
    throw new Error("Failed to get Deepgram API key");
  }
};

const DeepgramContextProvider: FunctionComponent<
  DeepgramContextProviderProps
> = ({ children }) => {
  const [connection, setConnection] = useState<LiveClient | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>(
    LiveConnectionState.CLOSED
  );
  const { toast } = useToast();

  const connectToDeepgram = async (options: LiveSchema, endpoint?: string) => {
    try {
      if (connection) {
        connection.finish();
        setConnection(null);
      }

      const key = await getApiKey();

      if (!key) {
        throw new Error("No API key available");
      }

      const deepgram = createClient(key);
      const project = deepgram.listen.live(options, endpoint);

      // Set up event listeners
      project.addListener(LiveTranscriptionEvents.Open, () => {
        console.log("Deepgram connection opened");
        setConnectionState(LiveConnectionState.OPEN);
        toast({
          title: "Connected",
          description: "Successfully connected to speech service",
          duration: 1000,
        });
      });

      project.addListener(LiveTranscriptionEvents.Close, () => {
        console.log("Deepgram connection closed");
        setConnectionState(LiveConnectionState.CLOSED);
      });

      project.addListener(LiveTranscriptionEvents.Error, (error) => {
        console.error("Deepgram connection error:", error);
        setConnectionState(LiveConnectionState.CLOSED);
        toast({
          title: "Connection Error",
          description: "Speech service connection error. Please try again.",
          variant: "destructive",
          duration: 1000,
        });
      });

      setConnection(project);

      // Set a timeout for the connection
      const timeout = setTimeout(() => {
        if (connectionState !== LiveConnectionState.OPEN) {
          project.finish();
          setConnection(null);
          setConnectionState(LiveConnectionState.CLOSED);
          throw new Error("Connection timeout");
        }
      }, 10000);

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        project.addListener(LiveTranscriptionEvents.Open, () => resolve());
        project.addListener(LiveTranscriptionEvents.Error, (error) =>
          reject(error)
        );
      });

      clearTimeout(timeout);
    } catch (error) {
      console.error("Error connecting to Deepgram:", error);
      setConnectionState(LiveConnectionState.CLOSED);
      setConnection(null);
      throw new Error("Failed to connect to speech service");
    }
  };

  const disconnectFromDeepgram = () => {
    if (connection) {
      connection.finish();
      setConnection(null);
      setConnectionState(LiveConnectionState.CLOSED);
    }
  };

  return (
    <DeepgramContext.Provider
      value={{
        connection,
        connectToDeepgram,
        disconnectFromDeepgram,
        connectionState,
      }}
    >
      {children}
    </DeepgramContext.Provider>
  );
};

function useDeepgram(): DeepgramContextType {
  const context = useContext(DeepgramContext);
  if (context === undefined) {
    throw new Error(
      "useDeepgram must be used within a DeepgramContextProvider"
    );
  }
  return context;
}

export {
  DeepgramContextProvider,
  useDeepgram,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveTranscriptionEvent,
};
