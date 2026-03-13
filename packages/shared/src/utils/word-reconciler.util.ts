import { WordTiming } from '../types/short.types';

/**
 * Normalize word for comparison: lowercase and strip punctuation.
 */
export function normalize(word: string): string {
    return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Compute Longest Common Subsequence (LCS) of two strings.
 */
export function computeLCS(originalWords: string[], newWords: string[]): string[] {
    const originalLength = originalWords.length;
    const newLength = newWords.length;
    const scoreMatrix: number[][] = Array.from({ length: originalLength + 1 }, () => Array(newLength + 1).fill(0));

    for (let originalIdx = 1; originalIdx <= originalLength; originalIdx++) {
        for (let newIdx = 1; newIdx <= newLength; newIdx++) {
            if (originalWords[originalIdx - 1] === newWords[newIdx - 1]) {
                scoreMatrix[originalIdx][newIdx] = scoreMatrix[originalIdx - 1][newIdx - 1] + 1;
            } else {
                scoreMatrix[originalIdx][newIdx] = Math.max(scoreMatrix[originalIdx - 1][newIdx], scoreMatrix[originalIdx][newIdx - 1]);
            }
        }
    }

    const longestCommonSubsequence: string[] = [];
    let originalIdx = originalLength;
    let newIdx = newLength;
    while (originalIdx > 0 && newIdx > 0) {
        if (originalWords[originalIdx - 1] === newWords[newIdx - 1]) {
            longestCommonSubsequence.unshift(originalWords[originalIdx - 1]);
            originalIdx--;
            newIdx--;
        } else if (scoreMatrix[originalIdx - 1][newIdx] > scoreMatrix[originalIdx][newIdx - 1]) {
            originalIdx--;
        } else {
            newIdx--;
        }
    }

    return longestCommonSubsequence;
}

/**
 * Uniformly distribute words over a duration.
 */
export function distributeWordsUniformly(text: string, startTime: number, endTime: number): WordTiming[] {
    const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return [];
    
    const duration = Math.max(0, endTime - startTime);
    const wordDuration = duration / tokens.length;
    
    return tokens.map((t, i) => ({
        text: t,
        startTime: startTime + i * wordDuration,
        endTime: startTime + (i + 1) * wordDuration,
    }));
}

/**
 * Reconcile word-level timings after a subtitle text edit.
 * Uses word-level diff (LCS) to preserve original Whisper timings where possible.
 */
export function reconcileWords(
    oldWords: WordTiming[] | undefined,
    newText: string,
    subtitleStart: number,
    subtitleEnd: number,
): WordTiming[] {
    const newTokens = newText.trim().split(/\s+/).filter(t => t.length > 0);
    if (newTokens.length === 0) return [];

    // Fallback if no old words exist
    if (!oldWords || oldWords.length === 0) {
        return distributeWordsUniformly(newText, subtitleStart, subtitleEnd);
    }

    // Fast path: same word count → 1:1 mapping (covers typo fixes, punctuation)
    if (newTokens.length === oldWords.length) {
        return oldWords.map((w, i) => ({ 
            text: newTokens[i],
            startTime: w.startTime,
            endTime: w.endTime
        }));
    }

    const oldTokensNormalized = oldWords.map(w => normalize(w.text));
    const newTokensNormalized = newTokens.map(t => normalize(t));

    const longestCommonSubsequence = computeLCS(oldTokensNormalized, newTokensNormalized);

    // Similarity check: if more than 60% of words are preserved, do smart merge
    const similarity = longestCommonSubsequence.length / Math.max(oldWords.length, newTokens.length);
    if (similarity > 0.6) {
        return smartMerge(
            oldWords, 
            newTokens, 
            oldTokensNormalized, 
            newTokensNormalized, 
            longestCommonSubsequence, 
            subtitleStart, 
            subtitleEnd
        );
    }

    // Drastic change → uniform distribution
    return distributeWordsUniformly(newText, subtitleStart, subtitleEnd);
}

/**
 * Smart merge strategy to maintain timings for preserved or corrected words.
 */
function smartMerge(
    oldWords: WordTiming[],
    newTokens: string[],
    oldNormalizedWords: string[],
    newNormalizedWords: string[],
    longestCommonSubsequence: string[],
    start: number,
    end: number
): WordTiming[] {
    const result: WordTiming[] = [];
    let oldWordIndex = 0;
    let newWordIndex = 0;
    let lcsIndex = 0;

    while (newWordIndex < newTokens.length) {
        const token = newTokens[newWordIndex];
        const normalizedToken = newNormalizedWords[newWordIndex];

        if (lcsIndex < longestCommonSubsequence.length && normalizedToken === longestCommonSubsequence[lcsIndex]) {
            // Find this word in oldWords (skip non-matching ones)
            while (oldWordIndex < oldWords.length && oldNormalizedWords[oldWordIndex] !== longestCommonSubsequence[lcsIndex]) {
                oldWordIndex++;
            }
            // Use old timing
            if (oldWordIndex < oldWords.length) {
                result.push({
                    text: token,
                    startTime: oldWords[oldWordIndex].startTime,
                    endTime: oldWords[oldWordIndex].endTime
                });
                oldWordIndex++;
                lcsIndex++;
            } else {
                // Should not happen with valid LCS, but fallback to uniform-ish
                const prevEnd = result.length > 0 ? result[result.length - 1].endTime : start;
                result.push({ text: token, startTime: prevEnd, endTime: prevEnd + 0.1 });
            }
        } else {
            // Insertion or Substitution
            // If oldWordIndex holds a word that isn't in LCS, it might be a substitution
            const oldWordInLCS = oldWordIndex < oldWords.length && longestCommonSubsequence.includes(oldNormalizedWords[oldWordIndex]);
            
            if (oldWordIndex < oldWords.length && !oldWordInLCS) {
                // Substitution: keep old timing but use new text
                result.push({
                    text: token,
                    startTime: oldWords[oldWordIndex].startTime,
                    endTime: oldWords[oldWordIndex].endTime
                });
                oldWordIndex++;
            } else {
                // Pure insertion: borrow time from previous or next
                const prevEnd = result.length > 0 ? result[result.length - 1].endTime : start;
                result.push({ text: token, startTime: prevEnd, endTime: prevEnd + 0.1 });
            }
        }
        newWordIndex++;
    }

    // Ensure timings are monotonic and fit within subtitle bounds
    return finalizeTimings(result, start, end);
}

/**
 * Ensure timings are strictly increasing and fit within the parent subtitle's duration.
 */
function finalizeTimings(words: WordTiming[], start: number, end: number): WordTiming[] {
    if (words.length === 0) return [];

    // Simple pass to fix overlaps or gaps
    for (let i = 0; i < words.length; i++) {
        // Clamp to subtitle bounds
        words[i].startTime = Math.max(start, words[i].startTime);
        words[i].endTime = Math.min(end, Math.max(words[i].startTime + 0.05, words[i].endTime));

        // Connect to previous
        if (i > 0 && words[i].startTime < words[i - 1].endTime) {
            words[i].startTime = words[i - 1].endTime;
            if (words[i].endTime <= words[i].startTime) {
                words[i].endTime = words[i].startTime + 0.05;
            }
        }
    }

    // Final check for end bound
    if (words[words.length - 1].endTime > end) {
        // Squish everything if needed (rare if words original timings were good)
        const lastEnd = words[words.length - 1].endTime;
        const totalSource = lastEnd - start;
        const totalTarget = end - start;
        const ratio = totalTarget / totalSource;

        for (const w of words) {
            w.startTime = start + (w.startTime - start) * ratio;
            w.endTime = start + (w.endTime - start) * ratio;
        }
    }

    return words;
}
