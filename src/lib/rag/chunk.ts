/**
 * Recursive text splitter for the RAG document chunking pipeline.
 *
 * Splits text into overlapping chunks using a multi-stage splitting strategy
 * that preserves semantic boundaries (paragraphs → lines → sentences → words).
 * Small chunks are re-merged up to {@link DEFAULT_CHUNK_SIZE} with configurable
 * token overlap between adjacent chunks for contextual continuity.
 *
 * @module chunk
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default maximum characters per chunk. */
const DEFAULT_CHUNK_SIZE = 800;

/** Default overlap characters between consecutive chunks. */
const DEFAULT_OVERLAP = 120;

/**
 * Separator patterns ordered from coarsest to finest semantic granularity.
 * Each stage is tried only when the previous one produces pieces that still
 * exceed the chunk size limit.
 */
const SEPARATORS: readonly RegExp[] = [
  /\n\n+/,           // 1. Paragraphs  (one or more blank lines)
  /\n/,              // 2. Lines       (single newline)
  /(?<=[.!?])\s+/,  // 3. Sentences   (punctuation followed by whitespace)
  /\s+/,             // 4. Words       (any whitespace run)
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Hard-splits a text string into fixed-size fragments.
 * This is the last-resort strategy when no semantic separator can break the
 * text down to the target chunk size (e.g. a single word longer than chunkSize).
 *
 * @param text      - The text to split.
 * @param chunkSize - Maximum length of each fragment.
 * @returns Array of fixed-size string fragments.
 */
function hardSplit(text: string, chunkSize: number): string[] {
  const fragments: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    fragments.push(text.slice(i, i + chunkSize));
  }
  return fragments;
}

/**
 * Recursively splits a text piece using increasingly fine-grained separators.
 *
 * For each separator level the text is split. If every resulting piece fits
 * within the chunk limit the recursion terminates. Pieces that still exceed
 * the limit are recursively processed with the next finer separator.
 *
 * @param text       - The text to split.
 * @param chunkSize  - Maximum characters per chunk.
 * @param separators - Ordered list of separator regexps.
 * @param depth      - Current separator index to attempt.
 * @returns Array of text pieces each ≤ `chunkSize` characters.
 */
function splitRecursive(
  text: string,
  chunkSize: number,
  separators: readonly RegExp[],
  depth: number,
): string[] {
  /* Base case – piece already fits within the limit. */
  if (text.length <= chunkSize) return [text];

  /* Fallback – no more separators to try, hard-split what remains. */
  if (depth >= separators.length) {
    return hardSplit(text, chunkSize);
  }

  /* Use match() instead of split() to preserve separators between pieces.
   * split() discards the separator, which causes words to get glued together
   * when pieces are later merged (e.g. "Hello world" → ["Hello","world"] → "Helloworld").
   * Each match captures trailing separator characters so they survive into the final chunk. */
  const separatorsAsMatch: readonly RegExp[] = [
    /[\s\S]*?(?:\n\n+|$)/g,  // paragraphs
    /[^\n]*(?:\n+|$)/g,      // lines
    /[^.!?]*[.!?]*\s*/g,     // sentences
    /\S+\s*/g,                // words
  ];
  const pieces =
    text.match(separatorsAsMatch[depth])?.filter(Boolean) ?? [];

  /* Separator not found – advance to the next finer level. */
  if (pieces.length <= 1) {
    return splitRecursive(text, chunkSize, separators, depth + 1);
  }

  const result: string[] = [];
  for (const piece of pieces) {
    if (piece.length === 0) continue; // skip empty fragments from regex
    result.push(...splitRecursive(piece, chunkSize, separators, depth + 1));
  }
  return result;
}

/**
 * Merges small text pieces into chunks of up to `chunkSize` characters
 * and applies overlap between consecutive chunks for contextual continuity.
 *
 * The algorithm accumulates base pieces until adding the next would exceed
 * the chunk limit. When a new chunk is started the previous chunk's trailing
 * `overlap` characters are prepended so no context is lost at boundaries.
 *
 * @param pieces    - Base pieces from the recursive split phase.
 * @param chunkSize - Target maximum size for each output chunk.
 * @param overlap   - Characters of overlap between adjacent chunks.
 * @returns Array of merged, overlapped text chunks.
 */
function mergeWithOverlap(
  pieces: string[],
  chunkSize: number,
  overlap: number,
): string[] {
  if (pieces.length === 0) return [];

  const merged: string[] = [];
  const effectiveOverlap = Math.min(overlap, chunkSize - 1);

  /* Seed the accumulator with the first piece. */
  let accumulator = pieces[0];

  for (let i = 1; i < pieces.length; i++) {
    const piece = pieces[i];

    if (accumulator.length + piece.length > chunkSize) {
      /* Flush current accumulator as a finished chunk. */
      merged.push(accumulator);

      /* Start a new chunk: tail of previous chunk + the current piece. */
      const overlapStart = Math.max(0, accumulator.length - effectiveOverlap);
      accumulator = accumulator.slice(overlapStart) + piece;
    } else {
      accumulator += piece;
    }
  }

  /* Push the final accumulator. */
  if (accumulator.length > 0) {
    merged.push(accumulator);
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Splits a text string into overlapping chunks suitable for a RAG embedding
 * pipeline.
 *
 * The function uses a **recursive splitting strategy** that respects natural
 * language boundaries:
 *
 *  1. **Paragraphs**  – split on double newlines (`\n\n+`)
 *  2. **Lines**       – split on single newlines (`\n`)
 *  3. **Sentences**   – split on `. ! ?` followed by whitespace
 *  4. **Words**       – split on whitespace runs
 *  5. **Hard split**  – last resort, splits at exactly `chunkSize`
 *
 * After splitting into base pieces the function **merges** small pieces back
 * together up to `chunkSize` and applies the configured **overlap** so that
 * the tail of each chunk is repeated at the start of the next, preserving
 * context across chunk boundaries.
 *
 * Empty strings and whitespace-only chunks are filtered from the result.
 *
 * @example
 * ```typescript
 * chunkText("Hello world.\n\nThis is a longer paragraph…")
 * // → ["Hello world.", "This is a longer paragraph…"]
 * ```
 *
 * @param text                 - The source text to split.
 * @param options              - Optional configuration.
 * @param options.chunkSize    - Max characters per chunk (default: 800).
 * @param options.overlap      - Overlap characters between chunks (default: 120).
 * @returns Array of text chunks, each ≤ `chunkSize` characters.
 */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): string[] {
  if (text.length === 0) return [];

  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  if (chunkSize <= 0) throw new RangeError('chunkSize must be > 0');
  if (overlap < 0) throw new RangeError('overlap must be >= 0');

  /* Phase 1 – recursive split into base pieces (all ≤ chunkSize). */
  const basePieces = splitRecursive(text, chunkSize, SEPARATORS, 0);

  /* Phase 2 – merge small pieces and apply overlap. */
  const merged = mergeWithOverlap(basePieces, chunkSize, overlap);

  /* Phase 3 – strip empty / whitespace-only results. */
  return merged.filter((chunk) => chunk.trim().length > 0);
}
