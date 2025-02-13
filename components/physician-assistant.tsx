"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Mic,
  Play,
  Pause,
  Copy,
  Check,
  Loader2,
  Eraser,
  CirclePause,
  StopCircle,
  RefreshCw,
  Ban,
  MicOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAutosizeTextArea } from "./AutoSizeTextArea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  LiveConnectionState,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  useDeepgram,
} from "../app/context/DeepgramContextProvider";
import {
  MicrophoneState,
  useMicrophone,
} from "../app/context/MicrophoneContextProvider";

export function PhysicianAssistant() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const transcriptionTimeout = useRef<NodeJS.Timeout>();
  const dataListenerRef = useRef<((e: BlobEvent) => void) | null>(null);
  const transcriptListenerRef = useRef<
    ((data: LiveTranscriptionEvent) => void) | null
  >(null);

  const {
    connection,
    connectToDeepgram,
    disconnectFromDeepgram,
    connectionState,
  } = useDeepgram();
  const {
    setupMicrophone,
    microphone,
    startMicrophone,
    stopMicrophone,
    pauseMicrophone,
    resumeMicrophone,
    microphoneState,
  } = useMicrophone();

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  useAutosizeTextArea({
    textAreaRef,
    triggerAutoSize: text,
    minHeight: 500,
    maxHeight: 500,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupListeners();
      stopMicrophone();
      disconnectFromDeepgram();
      if (transcriptionTimeout.current) {
        clearTimeout(transcriptionTimeout.current);
      }
    };
  }, []);

  // Handle microphone state changes
  useEffect(() => {
    switch (microphoneState) {
      case MicrophoneState.Error:
        setIsProcessing(false);
        setError("Failed to initialize microphone");
        break;
      case MicrophoneState.Ready:
        handleDeepgramConnection();
        break;
    }
  }, [microphoneState]);

  const cleanupListeners = () => {
    if (microphone && dataListenerRef.current) {
      microphone.removeEventListener("dataavailable", dataListenerRef.current);
      dataListenerRef.current = null;
    }
    if (connection && transcriptListenerRef.current) {
      connection.removeListener(
        LiveTranscriptionEvents.Transcript,
        transcriptListenerRef.current
      );
      transcriptListenerRef.current = null;
    }
  };

  // Handle Deepgram connection and transcription
  useEffect(() => {
    if (
      !microphone ||
      !connection ||
      connectionState !== LiveConnectionState.OPEN
    ) {
      return;
    }

    // Clean up any existing listeners
    cleanupListeners();

    // Create new listeners
    const onData = (e: BlobEvent) => {
      if (e.data.size > 0 && microphoneState === MicrophoneState.Recording) {
        connection.send(e.data);
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      if (transcriptionTimeout.current) {
        clearTimeout(transcriptionTimeout.current);
      }

      const transcript = data.channel.alternatives[0].transcript;
      const isFinal = data.is_final;

      if (transcript && isFinal) {
        setText((prev) => {
          const newText =
            prev + (prev && !prev.endsWith(" ") ? " " : "") + transcript;
          return newText;
        });
      }

      transcriptionTimeout.current = setTimeout(() => {
        setText((prev) => prev.trim());
      }, 1000);
    };

    // Store listeners in refs for cleanup
    dataListenerRef.current = onData;
    transcriptListenerRef.current = onTranscript;

    // Add new listeners
    connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
    microphone.addEventListener("dataavailable", onData);

    startMicrophone();
    setIsProcessing(false);
    setError(null);

    // Cleanup function
    return () => {
      cleanupListeners();
      if (transcriptionTimeout.current) {
        clearTimeout(transcriptionTimeout.current);
      }
    };
  }, [connectionState, connection, microphone, microphoneState]);

  const handleDeepgramConnection = async () => {
    try {
      await connectToDeepgram({
        model: "nova-3",
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 2000,
      });
    } catch (err) {
      setIsProcessing(false);
      setError("Failed to connect to speech service");
    }
  };

  const handleStartRecording = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      await setupMicrophone();
    } catch (err) {
      setIsProcessing(false);
      setError("Failed to start recording");
    }
  };

  // const handleStopRecording = () => {
  //   stopMicrophone();
  //   disconnectFromDeepgram();
  //   setIsProcessing(false);
  //   toast({
  //     title: "Recording stopped",
  //     description: "Speech-to-text conversion has been stopped.",
  //   });
  // };

  const handlePauseResume = () => {
    if (microphoneState === MicrophoneState.Recording) {
      pauseMicrophone();
      toast({
        title: "Recording paused",
        description: "Speech-to-text conversion has been paused.",
        duration: 1000,
      });
    } else if (microphoneState === MicrophoneState.Paused) {
      resumeMicrophone();
      toast({
        title: "Recording resumed",
        description: "Speech-to-text conversion has been resumed.",
        duration: 1000,
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
      toast({
        title: "Copied!",
        description: "Text has been copied to clipboard.",
        duration: 1000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy text. Please try again.",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  const handleClear = () => {
    setText("");
    toast({
      title: "Cleared",
      description: "Text has been cleared.",
    });
  };

  const handleStartStopRecording = async () => {
    if (
      microphoneState === MicrophoneState.Ready ||
      microphoneState === MicrophoneState.NotSetup
    ) {
      if (isProcessing) return;
      setIsProcessing(true);
      setError(null);
      try {
        await setupMicrophone();
      } catch (err) {
        setIsProcessing(false);
        setError("Failed to start recording");
      }
    } else {
      handleStopRecording();
    }
  };

  const handleStopRecording = () => {
    stopMicrophone();
    setRecordingState("idle");
    disconnectFromDeepgram();
    setIsProcessing(false);
    toast({
      title: "Recording stopped",
      description: "Speech-to-text conversion has been stopped.",
    });
  };

  const handleReset = () => {
    handleStopRecording();
    toast({
      title: "Reset complete",
      description: "Recording stopped and text cleared.",
    });
  };

  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "paused" | "processing"
  >("idle");
  const getMainButtonContent = () => {
    switch (recordingState) {
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "recording":
        return <Pause className="h-4 w-6" />;
      case "paused":
        return <Play className="h-4 w-4" />;
      default:
        return <Mic className="h-4 w-4" />;
    }
  };
  const handleMainButtonClick = async () => {
    switch (recordingState) {
      case "idle":
        setText("");
        setRecordingState("processing");
        setError(null);
        try {
          await handleStartStopRecording();
          setRecordingState("recording");
        } catch (err) {
          setRecordingState("idle");
          setError("Failed to start recording");
        }
        break;
      case "recording":
        pauseMicrophone();
        setRecordingState("paused");
        toast({
          title: "Recording paused",
          description: "Click resume to continue recording.",
        });
        break;
      case "paused":
        resumeMicrophone();
        setRecordingState("recording");
        toast({
          title: "Recording resumed",
          description: "Speech-to-text conversion resumed.",
        });
        break;
    }
  };
  const getMainButtonTooltip = () => {
    switch (recordingState) {
      case "processing":
        return "Processing...";
      case "recording":
        return "Stop Recording";
      case "paused":
        return "Resume Recording";
      default:
        return "Start Recording";
    }
  };

  const isRecording = microphoneState === MicrophoneState.Recording;
  const isPaused = microphoneState === MicrophoneState.Paused;

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg shadow-xl outline-none h-[600px] pb-10 p-2 bg-gray-800 fixed bottom-4 left-4 right-4 md:left-16 md:right-16 lg:left-72 lg:right-72 z-10 mx-auto"
      >
        <textarea
          className="p-4 block rounded-lg w-full border-0 bg-gray-800 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 focus-visible:no-underline outline-none"
          placeholder="Start recording or type your medical notes here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          ref={textAreaRef}
        />

        <div className="absolute bottom-px inset-x-px p-2 px-4 rounded-b-lg bg-gray-800 dark:bg-neutral-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      onClick={handleMainButtonClick}
                      disabled={recordingState === "processing"}
                      variant="default"
                      className={`bg-red-600 rounded-full px-3 hover:bg-red-700 ${
                        recordingState === "recording"
                          ? "animate-pulse px-2"
                          : ""
                      }`}
                    >
                      {getMainButtonContent()}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{getMainButtonTooltip()}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {recordingState !== "idle" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        onClick={handleReset}
                        variant="destructive"
                        className="bg-gray-700 rounded-full px-2 hover:bg-gray-600 ml-2"
                      >
                        <StopCircle className="h-5 w-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>End Conversion</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </AnimatePresence>
            {/* {isRecording && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        onClick={handleStopRecording}
                        variant="destructive"
                        className="bg-gray-700 rounded-full px-3 hover:bg-gray-600 ml-2"
                      >
                        <CirclePause className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop Recording</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            )} */}

            {/* {isRecording && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        onClick={handlePauseResume}
                        variant="secondary"
                        className="bg-gray-700 rounded-full px-3 hover:bg-gray-600"
                      >
                        {isPaused ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isPaused ? "Resume Recording" : "Pause Recording"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            )} */}
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    onClick={handleClear}
                    variant="ghost"
                    className="text-gray-400 px-3 rounded-full"
                    disabled={!text || isRecording}
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear Text</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    onClick={handleCopy}
                    variant="ghost"
                    className="text-gray-400 px-3 rounded-full"
                    disabled={!text}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy Text</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </motion.div>

      {(isRecording || isProcessing || error) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mt-4 text-center text-sm ${
            error ? "text-red-400" : "text-gray-400"
          }`}
        >
          {error
            ? error
            : isProcessing
            ? "Initializing..."
            : isPaused
            ? "Recording paused"
            : "Recording in progress..."}
        </motion.div>
      )}
    </div>
  );
}
