import { css } from 'lit';

/**
 * Shared styles for the YouTube Shorter project to ensure visual consistency
 * across different components and their Shadow DOMs.
 */
export const ytsPremiumStyles = css`
  /* Standard Shoelace Button Branding - Pixel Perfect Match */
  sl-button[variant="primary"], sl-button[variant="default"], sl-button[variant="danger"] {
    display: inline-block;
    width: 100%;
  }

  sl-button::part(base) {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
  }

  sl-button::part(prefix),
  sl-button::part(suffix) {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 0 !important;
  }

  sl-button sl-icon {
    display: inline-flex !important;
    align-items: center !important;
    vertical-align: middle !important;
  }

  sl-button[variant="primary"]::part(base) {
    background: #4f46e5 !important; /* Indigo vibrant blue matching the border */
    border: none !important;
    border-radius: 8px !important;
    color: white !important;
    font-weight: 600 !important;
    font-size: 15px !important;
    transition: all 0.2s ease;
    box-shadow: none !important;
    min-height: 48px !important;
    width: 100% !important;
  }

  sl-button[variant="primary"]::part(base):hover {
    background: #4338ca !important;
    transform: translateY(-1px) !important;
  }

  sl-button[variant="default"]::part(base) {
    background: transparent !important;
    border: none !important;
    color: white !important;
    font-weight: 600 !important;
    font-size: 15px !important;
    transition: all 0.2s ease;
    min-height: 48px !important;
    width: 100% !important;
  }

  sl-button[variant="default"]::part(base):hover {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  sl-button[variant="danger"]::part(base) {
    background: #ef4444 !important;
    border: none !important;
    border-radius: 8px !important;
    color: white !important;
    font-weight: 600 !important;
    font-size: 15px !important;
    min-height: 48px !important;
    width: 100% !important;
  }

  sl-button[variant="danger"]::part(base):hover {
    background: #dc2626 !important;
    transform: translateY(-1px) !important;
  }

  /* Glassmorphism Panel Utility */
  .yts-glass-panel {
    background: var(--yts-glass-bg, rgba(30, 35, 50, 0.7));
    backdrop-filter: blur(var(--yts-blur, 24px));
    -webkit-backdrop-filter: blur(var(--yts-blur, 24px));
    border: 1px solid var(--yts-glass-border, rgba(99, 102, 241, 0.3));
    border-radius: var(--yts-radius, 20px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4),
                inset 0 0 20px rgba(255, 255, 255, 0.02);
  }
`;
