import { useEffect } from 'react';
import type { Answer } from '../types/game';

export type ActiveModal =
  | { type: 'help' }
  | { type: 'credits' }
  | { type: 'share' }
  | { type: 'copyFallback'; text: string }
  | {
      type: 'confirm';
      eyebrow: string;
      title: string;
      message: string;
      confirmLabel: string;
      onConfirm: () => void;
    }
  | {
      type: 'typo';
      raw: string;
      matches: Answer[];
      onSelect: (answer: Answer) => void;
      onRetry: () => void;
      onSubmitAsTyped: () => void;
    };

interface ModalDialogProps {
  modal: ActiveModal | null;
  onClose: () => void;
  onExportJson: () => void;
  onExportHtml: () => void;
  onToast: (message: string) => void;
}

export function ModalDialog({
  modal,
  onClose,
  onExportJson,
  onExportHtml,
  onToast,
}: ModalDialogProps) {
  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (modal.type === 'typo') {
          modal.onRetry();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal, onClose]);

  if (!modal) return null;

  const handleBackdropClick = () => {
    if (modal.type === 'typo') {
      modal.onRetry();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-[#00091bba] backdrop-blur-[3px]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="text-[#e0e9f5] bg-[#101c30] border-2 border-[#5da7bb] p-5 sm:p-7 max-w-[620px] w-full max-h-[85vh] overflow-auto shadow-[8px_8px_0_#0005]"
        onClick={(e) => e.stopPropagation()}
      >
        {modal.type === 'help' && (
          <div>
            <h2 className="text-[30px] sm:text-[36px] font-normal leading-[1.1] text-[#5de3f9] mb-5">
              HOW TO PLAY KRILLION
            </h2>
            <p className="text-[21px] text-[#93a6c4] leading-[1.45] mb-4">
              Answer each prompt before the oxygen clock runs out. Obvious answers
              keep you near the surface (10 pts), while obscure valid answers sink
              you up to 1,000 metres per round.
            </p>
            <p className="text-[21px] text-[#93a6c4] leading-[1.45] mb-4">
              <b className="text-[#e0e9f5]">Invalid answer?</b> Keep trying while
              the timer runs. A one-letter typo or swapped adjacent pair opens a
              confirmation prompt while pausing the clock.
            </p>
            <p className="text-[21px] text-[#93a6c4] leading-[1.45] mb-4">
              Accepted answers lock the round. You can browse every accepted
              answer <b className="text-[#e0e9f5]">only after you surface</b> at
              the end.
            </p>
            <p className="text-[21px] text-[#93a6c4] leading-[1.45] mb-4">
              Use <b className="text-[#e0e9f5]">EDIT GAME</b> to customize prompts,
              aliases, and scoring tiers, or export a JSON pack or standalone
              offline HTML file.
            </p>
            <p className="text-[17px] text-[#93a6c4] leading-[1.45] mb-5">
              Category scores are creator-defined, not live global statistics.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="krillion-btn krillion-btn-primary text-[20px]"
            >
              GOT IT
            </button>
          </div>
        )}

        {modal.type === 'share' && (
          <div>
            <div className="text-[17px] tracking-[3px] text-[#ff528d] uppercase mb-2">
              SEND AN EXPEDITION
            </div>
            <h2 className="text-[30px] sm:text-[36px] font-normal leading-[1.1] text-[#5de3f9] mb-4">
              GOOD QUESTIONS TRAVEL.
            </h2>
            <p className="text-[19px] sm:text-[21px] text-[#93a6c4] leading-[1.45] mb-3">
              <b className="text-[#e0e9f5]">Portable HTML</b> includes the game,
              editor, pixel art, font, and synthesized sound in one offline file.
            </p>
            <button
              type="button"
              onClick={onExportHtml}
              className="krillion-btn krillion-btn-primary w-full sm:w-auto text-[18px] sm:text-[20px] mb-5"
            >
              DOWNLOAD PORTABLE HTML
            </button>
            <p className="text-[19px] sm:text-[21px] text-[#93a6c4] leading-[1.45] mb-3">
              <b className="text-[#e0e9f5]">Game pack</b> is a compact JSON file
              with your prompts, answers, and custom tiers.
            </p>
            <button
              type="button"
              onClick={onExportJson}
              className="krillion-btn w-full sm:w-auto text-[18px] sm:text-[20px] mb-5"
            >
              DOWNLOAD GAME PACK
            </button>
            <p className="text-[17px] text-[#93a6c4] leading-[1.45] mb-5">
              Older v1 packs import with their original points. Exported files
              contain their answer lists.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="krillion-btn krillion-btn-quiet text-[20px]"
            >
              DONE
            </button>
          </div>
        )}

        {modal.type === 'credits' && (
          <div>
            <h2 className="text-[36px] font-normal leading-[1.1] text-[#5de3f9] mb-4">
              KRILLION · CUSTOM EDITION
            </h2>
            <p className="text-[18px] text-[#93a6c4] leading-[1.45] mb-4">
              An independent, offline custom-game player inspired by{' '}
              <a
                href="https://krillion.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5de3f9] underline"
              >
                krillion.io
              </a>
              . Not affiliated with its creator.
            </p>
            <p className="text-[18px] text-[#93a6c4] leading-[1.45] mb-5">
              Tier sprites and underwater textures are embedded locally. Pixel
              font: VT323 by Peter Hull (SIL Open Font License). Ocean scene,
              workshop, game logic, and Web Audio synth run entirely offline.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="krillion-btn text-[20px]"
            >
              DONE
            </button>
          </div>
        )}

        {modal.type === 'typo' && (
          <div>
            <div className="text-[17px] tracking-[3px] text-[#ff528d] uppercase mb-2">
              A TINY COURSE CORRECTION
            </div>
            <h2 className="text-[36px] font-normal leading-[1.1] text-[#5de3f9] mb-3">
              DID YOU MEAN…?
            </h2>
            <p className="text-[21px] text-[#93a6c4] leading-[1.45] mb-4">
              You typed “{modal.raw}”. The oxygen clock is paused while you
              choose.
            </p>
            <div className="grid gap-2.5">
              {modal.matches.map((answer) => (
                <button
                  key={answer.text}
                  type="button"
                  onClick={() => modal.onSelect(answer)}
                  className="krillion-btn krillion-btn-primary text-[22px] text-left"
                >
                  {answer.text}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-5">
              <button
                type="button"
                onClick={modal.onRetry}
                className="krillion-btn text-[19px]"
              >
                KEEP TYPING
              </button>
              <button
                type="button"
                onClick={modal.onSubmitAsTyped}
                className="krillion-btn krillion-btn-quiet text-[19px]"
              >
                SUBMIT AS TYPED
              </button>
            </div>
          </div>
        )}

        {modal.type === 'confirm' && (
          <div>
            <div className="text-[17px] tracking-[3px] text-[#ff528d] uppercase mb-2">
              {modal.eyebrow}
            </div>
            <h2 className="text-[36px] font-normal leading-[1.1] text-[#5de3f9] mb-3">
              {modal.title}
            </h2>
            <p className="text-[21px] text-[#93a6c4] leading-[1.45] mb-5">
              {modal.message}
            </p>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  modal.onConfirm();
                  onClose();
                }}
                className="krillion-btn krillion-btn-pink text-[19px]"
              >
                {modal.confirmLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="krillion-btn krillion-btn-quiet text-[19px]"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {modal.type === 'copyFallback' && (
          <div>
            <h2 className="text-[36px] font-normal leading-[1.1] text-[#5de3f9] mb-3">
              COPY YOUR RESULTS
            </h2>
            <textarea
              rows={10}
              readOnly
              value={modal.text}
              onClick={(e) => {
                (e.target as HTMLTextAreaElement).select();
                onToast('Selected — press Ctrl+C or Cmd+C.');
              }}
              className="krillion-input text-[19px] mb-3"
            />
            <p className="text-[18px] text-[#93a6c4] mb-4">
              Press Ctrl+C (or Cmd+C) to copy your spoiler-free dive summary.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="krillion-btn text-[20px]"
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
