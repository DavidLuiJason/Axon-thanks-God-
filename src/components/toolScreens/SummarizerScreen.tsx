/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Summarizer Screen: Shorten a text by extracting key sentences.
 * Uses the pure extractive summarize engine in src/tools/engines/text/summarize.ts
 * and decodes imported text files with src/tools/engines/files/documentRead.ts.
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import { Copy, Check, FileText, Upload, Sparkles } from 'lucide-react';
import { ToolScreenShell } from '../tools/ToolScreenShell';
import {
  copyToClipboard,
  ErrorLine,
  LabelledTextArea,
  OptionsDisclosure,
  PrimaryButton,
  ResultBox,
  SegmentedChoice,
  SwitchRow,
} from '../tools/ToolParts';
import {
  summarizeText,
  SUMMARIZE_LIMITS,
  type SummarizeResult,
} from '../../tools/engines/text/summarize';
import { readDocument } from '../../tools/engines/files/documentRead';

export const toolScreen = { toolId: 'summarizer' };

export interface SummarizerScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

type SummaryLength = 'short' | 'medium' | 'long';

const LENGTH_CHOICES = [
  { id: 'short', label: 'Short (3)' },
  { id: 'medium', label: 'Medium (5)' },
  { id: 'long', label: 'Long (8)' },
] as const;

const SENTENCE_COUNTS: Record<SummaryLength, number> = {
  short: 3,
  medium: 5,
  long: 8,
};

export const SummarizerScreen: React.FC<SummarizerScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const [inputText, setInputText] = useState('');
  const [lengthChoice, setLengthChoice] = useState<SummaryLength>('medium');
  const [showKeywords, setShowKeywords] = useState(false);
  const [result, setResult] = useState<SummarizeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const doc = readDocument({ name: file.name, bytes });

      if (!doc.ok) {
        setErrorMessage(doc.message);
        setFileNotice(null);
        return;
      }

      const plainText = doc.blocks.map((b) => b.text).join('\n\n');
      if (!plainText.trim()) {
        setErrorMessage('The chosen file contains no readable text.');
        setFileNotice(null);
        return;
      }

      setInputText(plainText);
      setErrorMessage(null);
      setResult(null);
      setFileNotice(
        `Loaded "${file.name}" (${doc.format.toUpperCase()}, ${doc.stats.words.toLocaleString()} words)`
      );
    } catch {
      setErrorMessage('Could not read the chosen file.');
      setFileNotice(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSummarize = () => {
    setErrorMessage(null);
    setFileNotice(null);

    if (!inputText.trim()) {
      setErrorMessage('Enter text to summarize.');
      setResult(null);
      return;
    }

    if (inputText.length > SUMMARIZE_LIMITS.maxCharacters) {
      setErrorMessage(
        `Text exceeds the ${SUMMARIZE_LIMITS.maxCharacters.toLocaleString()} character limit.`
      );
      setResult(null);
      return;
    }

    const sentences = SENTENCE_COUNTS[lengthChoice];
    const res = summarizeText(inputText, { sentences, keywords: 12 });

    if (!res.ok) {
      setErrorMessage(res.message);
      setResult(null);
      return;
    }

    setResult(res);
  };

  const handleLengthChange = (val: SummaryLength) => {
    setLengthChoice(val);
    if (result && result.ok && inputText.trim()) {
      const sentences = SENTENCE_COUNTS[val];
      const res = summarizeText(inputText, { sentences, keywords: 12 });
      if (res.ok) {
        setResult(res);
      } else {
        setErrorMessage(res.message);
        setResult(null);
      }
    }
  };

  const summaryText = useMemo(() => {
    if (!result || !result.ok) return '';
    return result.sentences.map((s) => s.text).join('\n\n');
  }, [result]);

  const handleCopy = async () => {
    if (!summaryText) return;
    const ok = await copyToClipboard(summaryText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearAll = () => {
    setInputText('');
    setResult(null);
    setErrorMessage(null);
    setFileNotice(null);
  };

  return (
    <ToolScreenShell
      toolName="Summarizer"
      tagline="Selects important original sentences without rewriting them"
      onBack={onBack}
      onLogoClick={onLogoClick}
    >
      <div className="space-y-4">
        {/* Hidden file input for opening text files */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.text,.md,.markdown,.html,.htm,.log"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload text file"
        />

        {/* Input Text Area and File Upload Action */}
        <div className="space-y-2">
          <LabelledTextArea
            id={inputId}
            label="Original Text"
            value={inputText}
            onChange={(val) => {
              setInputText(val);
              if (errorMessage) setErrorMessage(null);
              if (!val.trim()) setResult(null);
            }}
            placeholder="Paste text here or choose a text file below..."
            rows={7}
            maxLength={SUMMARIZE_LIMITS.maxCharacters}
            onClear={handleClearAll}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleFileClick}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-[#ECECEC] transition-colors cursor-pointer flex items-center gap-2 border border-white/5"
            >
              <Upload size={14} className="text-[#8E9094]" />
              <span>Choose a text file</span>
            </button>

            {fileNotice && (
              <span className="text-xs text-[#8E9094] truncate max-w-xs pl-1">
                {fileNotice}
              </span>
            )}
          </div>
        </div>

        {/* Summary Length Controls */}
        <SegmentedChoice<SummaryLength>
          label="Summary length"
          choices={LENGTH_CHOICES}
          value={lengthChoice}
          onChange={handleLengthChange}
        />

        {/* Options Row (Progressive Disclosure) */}
        <OptionsDisclosure title="Options">
          <SwitchRow
            label="Show key words"
            description="Display extracted vocabulary terms ranked by significance"
            checked={showKeywords}
            onChange={setShowKeywords}
          />
          <div className="pt-1 text-xs text-[#8E9094] flex items-center justify-between border-t border-white/5">
            <span>Sentences kept</span>
            <span className="font-mono text-white">
              {result && result.ok
                ? `${result.stats.sentencesOut} of ${result.stats.sentencesIn}`
                : 'Available after summarizing'}
            </span>
          </div>
        </OptionsDisclosure>

        {/* Primary Action Button */}
        <PrimaryButton
          onClick={handleSummarize}
          disabled={!inputText.trim()}
          className="w-full"
          icon={<Sparkles size={16} />}
        >
          Summarize
        </PrimaryButton>

        {/* Error message */}
        <ErrorLine message={errorMessage} />

        {/* Results Presentation */}
        {result && result.ok && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#8E9094]">
                Extracted Sentences
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9A9B9F] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Extracted sentences ordered as in the original source */}
            <div className="min-h-[64px] w-full bg-[#18191C] border border-white/10 rounded-xl p-4 text-sm text-[#ECECEC] font-sans leading-relaxed select-text space-y-3">
              {result.sentences.map((sentence, idx) => (
                <p key={idx} className="leading-relaxed">
                  {sentence.text}
                </p>
              ))}
            </div>

            {/* Quiet engine label line */}
            <p className="text-xs text-[#8E9094] italic leading-normal pl-0.5">
              {result.label}
            </p>

            {/* Summary character count */}
            {summaryText.length > 0 && inputText.length > 0 && (
              <p className="text-xs text-[#8E9094] leading-normal pl-0.5">
                Summary: {summaryText.length.toLocaleString()} characters (from {inputText.length.toLocaleString()})
              </p>
            )}

            {/* Any engine warnings in plain words */}
            {result.warnings.length > 0 && (
              <div className="space-y-1 pt-1">
                {result.warnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-[#E0B4A8] leading-normal pl-0.5">
                    {warning}
                  </p>
                ))}
              </div>
            )}

            {/* Key words (when toggled on in options) */}
            {showKeywords && result.keywords.length > 0 && (
              <div className="p-3.5 bg-[#161719] border border-white/5 rounded-xl space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E9094]">
                  Key Words
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[#D1D2D6]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolScreenShell>
  );
};

export default SummarizerScreen;
