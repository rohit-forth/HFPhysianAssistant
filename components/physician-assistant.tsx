"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Copy,
  Check,
  Loader2,
  Eraser,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeepgramRefs {
  mediaRecorder: MediaRecorder | null;
  socket: WebSocket | null;
  stream: MediaStream | null;
  transcripts: string[];
}

export function PhysicianAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTranscriptionInitialized = useRef(false);
  const lastCallRef = useRef(Date.now());
  const { toast } = useToast();

  const refs = useRef<DeepgramRefs>({
    mediaRecorder: null,
    socket: null,
    stream: null,
    transcripts: [],
  });

  const cleanup = async () => {
    try {
      if (refs.current.mediaRecorder?.state !== 'inactive') {
        refs.current.mediaRecorder?.stop();
      }

      if (refs.current.socket?.readyState === WebSocket.OPEN) {
        refs.current.socket.close();
      }

      if (refs.current.stream) {
        refs.current.stream.getTracks().forEach(track => track.stop());
      }

      refs.current = {
        mediaRecorder: null,
        socket: null,
        stream: null,
        transcripts: [],
      };
      isTranscriptionInitialized.current = false;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  const handleStartRecording = async () => {
    const now = Date.now();
    if (now - lastCallRef.current < 1000) {
      toast({
        title: "Please wait",
        description: "Too many requests. Please wait a moment.",
        variant: "destructive",
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
        mimeType: 'audio/webm',
      });
      refs.current.mediaRecorder = mediaRecorder;

      // Create WebSocket connection to Deepgram
      const socket = new WebSocket('wss://api.deepgram.com/v1/listen', [
        'token',
        'c7f2be50ae5262222eb302d1b47a8099e476b306',
      ]);

      socket.onopen = () => {
        console.log('WebSocket connection established');
        socket.send(JSON.stringify({
          type: 'Configure',
          model: 'nova-2',
          language: 'en-US',
          smart_format: true,
          interim_results: true,
          utterance_end_ms: 1000,
          vad_events: true,
          endpointing: 500,
        }));

        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (socket.readyState === WebSocket.OPEN && event.data.size > 0) {
            socket.send(event.data);
          }
        });

        mediaRecorder.start(250);
        setIsRecording(true);
        setIsProcessing(false);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';

        if (data.is_final && transcript) {
          refs.current.transcripts.push(transcript);
          setText(prev => prev + (prev ? ' ' : '') + transcript);
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Error",
          description: "Transcription error occurred. Please try again.",
          variant: "destructive",
        });
        handleStopRecording();
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed');
      };

      refs.current.socket = socket;

    } catch (error) {
      console.error("Error initializing microphone or WebSocket:", error);
      toast({
        title: "Error",
        description: "Failed to start recording. Please check microphone permissions.",
        variant: "destructive",
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
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy text. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setText('');
    toast({
      title: "Cleared",
      description: "Text has been cleared.",
    });
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700"
      >
        <ScrollArea className="h-[200px] w-full rounded-md border border-gray-700 bg-gray-900 p-4">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start recording or type your medical notes here..."
            className="min-h-[380px] resize-none bg-transparent border-none focus-visible:ring-0 text-gray-200 overflow-hidden"
          />
        </ScrollArea>

        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {!isRecording ? (
                <motion.div
                  key="record"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Button
                    onClick={handleStartRecording}
                    disabled={isProcessing}
                    variant="default"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Mic className="h-4 w-4 mr-2" />
                    )}
                    Record
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="stop"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Button
                    onClick={handleStopRecording}
                    variant="destructive"
                    className={isRecording && !isPaused ? 'animate-pulse' : ''}
                  >
                    <MicOff className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {isRecording && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Button
                  onClick={handlePauseResume}
                  variant="secondary"
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleClear}
              variant="ghost"
              className="text-gray-400"
              disabled={!text || isRecording}
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              onClick={handleCopy}
              variant="secondary"
              className="bg-gray-700 hover:bg-gray-600"
              disabled={!text}
            >
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </motion.div>

      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center text-sm text-gray-400"
        >
          {isPaused ? 'Recording paused' : 'Recording in progress...'}
        </motion.div>
      )}
    </div>
  );
}