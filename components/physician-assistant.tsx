"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Textarea } from "@/components/ui/textarea";
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Copy,
  Check,
  Loader2,
  Eraser,
  StopCircle,
  CirclePause,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAutosizeTextArea } from "./AutoSizeTextArea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface DeepgramRefs {
  mediaRecorder: MediaRecorder | null;
  socket: WebSocket | null;
  stream: MediaStream | null;
  transcripts: string[];
}

export function PhysicianAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTranscriptionInitialized = useRef(false);
  const lastCallRef = useRef(Date.now());
  const { toast } = useToast();

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const [triggerAutoSize, setTriggerAutoSize] = React.useState("");
  useAutosizeTextArea({
    textAreaRef,
    triggerAutoSize: triggerAutoSize,
    minHeight: 220,
    maxHeight: 200,
  });
  const refs = useRef<DeepgramRefs>({
    mediaRecorder: null,
    socket: null,
    stream: null,
    transcripts: [],
  });

  const cleanup = async () => {
    try {
      if (refs.current.mediaRecorder?.state !== "inactive") {
        refs.current.mediaRecorder?.stop();
      }

      if (refs.current.socket?.readyState === WebSocket.OPEN) {
        refs.current.socket.close();
      }

      if (refs.current.stream) {
        refs.current.stream.getTracks().forEach((track) => track.stop());
      }

      refs.current = {
        mediaRecorder: null,
        socket: null,
        stream: null,
        transcripts: [],
      };
      isTranscriptionInitialized.current = false;
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  };

  const handleStartRecording = async () => {
    const now = Date.now();
    if (now - lastCallRef.current < 1000) {
      toast({
        title: "Please wait",
        description: "Too many requests. Please wait a moment.",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    lastCallRef.current = now;

    if (isProcessing || isTranscriptionInitialized.current) return;

    try {
      setIsProcessing(true);
      await cleanup();
      isTranscriptionInitialized.current = true;

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
      refs.current.stream = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      refs.current.mediaRecorder = mediaRecorder;

      // Create WebSocket connection to Deepgram
      const socket = new WebSocket("wss://api.deepgram.com/v1/listen", [
        "token",
        "d3ec5b8d86c1f5ff95bc89aee2aad135eb8b059f",
      ]);

      socket.onopen = () => {
        console.log("WebSocket connection established");
        socket.send(
          JSON.stringify({
            type: "Configure",
            model: "nova-2-medical",
            language: "en-US",

            interim_results: true,
            utterance_end_ms: 1000,
          })
        );

        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (socket.readyState === WebSocket.OPEN && event.data.size > 0) {
            socket.send(event.data);
          }
        });

        mediaRecorder.start(250);
        setIsRecording(true);
        setIsProcessing(false);
      };

      setInterval(() => {
        const keepAliveMsg = JSON.stringify({ type: "KeepAlive" });
        socket.send(keepAliveMsg);
        console.log("Sent KeepAlive message");
      }, 2500);
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const transcript = data.channel?.alternatives?.[0]?.transcript || "";

        if (data.is_final && transcript) {
          refs.current.transcripts.push(transcript);
          setText((prev) => prev + (prev ? " " : "") + transcript);
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Error",
          description: "Transcription error occurred. Please try again.",
          variant: "destructive",
          duration: 2000,
        });
        handleStopRecording();
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed");
      };

      refs.current.socket = socket;
    } catch (error) {
      console.error("Error initializing microphone or WebSocket:", error);
      toast({
        title: "Error",
        description:
          "Failed to start recording. Please check microphone permissions.",
        variant: "destructive",
        duration: 2000,
      });
      setIsProcessing(false);
      await cleanup();
    }
  };

  const handleStopRecording = async () => {
    try {
      await cleanup();
      setIsRecording(false);
      setIsPaused(false);
      toast({
        title: "Recording stopped",
        description: "Speech-to-text conversion has been stopped.",
      });
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast({
        title: "Error",
        description: "Failed to stop recording properly.",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handlePauseResume = () => {
    if (!refs.current.mediaRecorder) return;

    if (isPaused) {
      refs.current.mediaRecorder.resume();
    } else {
      refs.current.mediaRecorder.pause();
    }

    setIsPaused(!isPaused);
    toast({
      title: isPaused ? "Recording resumed" : "Recording paused",
      description: isPaused
        ? "Speech-to-text conversion has been resumed."
        : "Speech-to-text conversion has been paused.",
      duration: 2000,
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Text has been copied to clipboard.",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy text. Please try again.",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleClear = () => {
    setText("");
    toast({
      title: "Cleared",
      description: "Text has been cleared.",
      duration: 2000,
    });
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="max-w-3xl  mx-auto ">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg shadow-xl outline-none h-[250px] pb-10 p-2 bg-gray-800 fixed bottom-4 left-4 right-4 md:left-16 md:right-16 lg:left-72 lg:right-72 z-10 mx-auto"
      >
        <textarea
          className="p-4 block rounded-lg w-full border-0 bg-gray-800 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 focus-visible:no-underline outline-none"
          placeholder="Start recording or type your medical notes here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          ref={textAreaRef}
        ></textarea>

        <div className="absolute bottom-px inset-x-px p-2 px-4 rounded-b-lg bg-gray-800 dark:bg-neutral-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {!isRecording ? (
                <motion.div
                  key="record"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          onClick={handleStartRecording}
                          disabled={isProcessing}
                          variant="default"
                          className="bg-red-600 rounded-full px-3 hover:bg-red-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mic className="h-4 w-4 " />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Start Recording</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </motion.div>
              ) : (
                <motion.div
                  key="stop"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          onClick={handleStopRecording}
                          variant="destructive"
                          className={`px-3 rounded-full ${
                            isRecording && !isPaused ? "animate-pulse " : ""
                          }`}
                        >
                          <CirclePause className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Stop Recording</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </motion.div>
              )}
            </AnimatePresence>

            {isRecording && (
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
                          <>
                            <Play className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 " />
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isPaused ? "Resume Recording" : "Pause Recording"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            )}
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
                    variant="secondary"
                    className="bg-gray-700 px-3 rounded-full hover:bg-gray-600"
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

      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center text-sm text-gray-400"
        >
          {isPaused ? "Recording paused" : "Recording in progress..."}
        </motion.div>
      )}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center text-sm text-gray-400"
        >
          {"Initializing..."}
        </motion.div>
      )}
    </div>
  );
}
