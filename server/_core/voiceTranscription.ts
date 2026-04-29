/**
 * Voice transcription helper using internal Speech-to-Text service
 *
 * Frontend implementation guide:
 * 1. Capture audio using MediaRecorder API
 * 2. Upload audio to storage (e.g., S3) to get URL
 * 3. Call transcription with the URL
 * 
 * Example usage:
 * ```tsx
 * // Frontend component
 * const transcribeMutation = trpc.voice.transcribe.useMutation({
 *   onSuccess: (data) => {
 *     console.log(data.text); // Full transcription
 *     console.log(data.language); // Detected language
 *     console.log(data.segments); // Timestamped segments
 *   }
 * });
 * 
 * // After uploading audio to storage
 * transcribeMutation.mutate({
 *   audioUrl: uploadedAudioUrl,
 *   language: 'en', // optional
 *   prompt: 'Transcribe the meeting' // optional
 * });
 * ```
 */
import { ENV } from "./env";

export type TranscribeOptions = {
  audioUrl: string; // URL to the audio file (e.g., S3 URL)
  language?: string; // Optional: specify language code (e.g., "en", "es", "zh")
  prompt?: string; // Optional: custom prompt for the transcription
};

// Native Whisper API segment format
export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

// Native Whisper API response format
export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse; // Return native Whisper API response directly

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

/**
 * Core: send an already-in-memory audio buffer directly to Whisper.
 * Skips any storage upload/download round-trip.
 */
async function callWhisper(
  audioBuffer: Buffer,
  mimeType: string,
  language?: string,
  prompt?: string
): Promise<TranscriptionResponse | TranscriptionError> {
  if (!ENV.forgeApiUrl) {
    return { error: "Voice transcription service is not configured", code: "SERVICE_ERROR", details: "BUILT_IN_FORGE_API_URL is not set" };
  }
  if (!ENV.forgeApiKey) {
    return { error: "Voice transcription service authentication is missing", code: "SERVICE_ERROR", details: "BUILT_IN_FORGE_API_KEY is not set" };
  }

  const filename = `audio.${getFileExtension(mimeType)}`;
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  const formData = new FormData();
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  const resolvedPrompt = prompt || (
    language
      ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(language)}`
      : "Transcribe the user's voice to text"
  );
  formData.append("prompt", resolvedPrompt);

  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${ENV.forgeApiKey}`, "Accept-Encoding": "identity" },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return { error: "Transcription service request failed", code: "TRANSCRIPTION_FAILED", details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}` };
  }

  const whisperResponse = await response.json() as WhisperResponse;
  if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
    return { error: "Invalid transcription response", code: "SERVICE_ERROR", details: "Transcription service returned an invalid response format" };
  }
  return whisperResponse;
}

/**
 * Transcribe audio from an in-memory Buffer directly (no storage round-trip).
 */
export async function transcribeBuffer(options: {
  buffer: Buffer;
  mimeType: string;
  language?: string;
  prompt?: string;
}): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const sizeMB = options.buffer.length / (1024 * 1024);
    if (sizeMB > 16) {
      return { error: "Audio file exceeds maximum size limit", code: "FILE_TOO_LARGE", details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB` };
    }
    return await callWhisper(options.buffer, options.mimeType, options.language, options.prompt);
  } catch (error) {
    return { error: "Voice transcription failed", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "An unexpected error occurred" };
  }
}

/**
 * Transcribe audio to text using the internal Speech-to-Text service
 * (fetches audio from a URL first, then calls Whisper)
 */
export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      return !ENV.forgeApiUrl
        ? { error: "Voice transcription service is not configured", code: "SERVICE_ERROR", details: "BUILT_IN_FORGE_API_URL is not set" }
        : { error: "Voice transcription service authentication is missing", code: "SERVICE_ERROR", details: "BUILT_IN_FORGE_API_KEY is not set" };
    }

    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(options.audioUrl);
      if (!response.ok) {
        return { error: "Failed to download audio file", code: "INVALID_FORMAT", details: `HTTP ${response.status}: ${response.statusText}` };
      }
      audioBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get("content-type") || "audio/mpeg";
    } catch (error) {
      return { error: "Failed to fetch audio file", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "Unknown error" };
    }

    return await transcribeBuffer({ buffer: audioBuffer, mimeType, language: options.language, prompt: options.prompt });
  } catch (error) {
    return { error: "Voice transcription failed", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "An unexpected error occurred" };
  }
}

/**
 * Helper function to get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
  };
  
  return mimeToExt[mimeType] || 'audio';
}

/**
 * Helper function to get full language name from ISO code
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
  };
  
  return langMap[langCode] || langCode;
}

/**
 * Example tRPC procedure implementation:
 * 
 * ```ts
 * // In server/routers.ts
 * import { transcribeAudio } from "./_core/voiceTranscription";
 * 
 * export const voiceRouter = router({
 *   transcribe: protectedProcedure
 *     .input(z.object({
 *       audioUrl: z.string(),
 *       language: z.string().optional(),
 *       prompt: z.string().optional(),
 *     }))
 *     .mutation(async ({ input, ctx }) => {
 *       const result = await transcribeAudio(input);
 *       
 *       // Check if it's an error
 *       if ('error' in result) {
 *         throw new TRPCError({
 *           code: 'BAD_REQUEST',
 *           message: result.error,
 *           cause: result,
 *         });
 *       }
 *       
 *       // Optionally save transcription to database
 *       await db.insert(transcriptions).values({
 *         userId: ctx.user.id,
 *         text: result.text,
 *         duration: result.duration,
 *         language: result.language,
 *         audioUrl: input.audioUrl,
 *         createdAt: new Date(),
 *       });
 *       
 *       return result;
 *     }),
 * });
 * ```
 */
