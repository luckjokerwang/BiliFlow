import React from 'react';
import { browser } from 'wxt/browser';

const KNOWN_LOGOS = new Set([
  'deepseek',
  'openai',
  'gemini',
  'siliconflow',
  'moonshot',
  'zhipu',
  'ollama',
  'sensenova',
  'openrouter',
]);

export const ProviderLogo: React.FC<{
  providerId: string;
  icon?: string;
  className?: string;
}> = ({ providerId, icon, className = 'w-5 h-5' }) => {
  if (KNOWN_LOGOS.has(providerId)) {
    const filename = `${providerId}.svg`;
    const src =
      typeof browser !== 'undefined' && browser.runtime?.getURL
        ? browser.runtime.getURL(`logos/${filename}`)
        : typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL(`logos/${filename}`)
        : `/logos/${filename}`;

    return (
      <img
        src={src}
        alt={providerId}
        className={`${className} object-contain inline-block shrink-0`}
        loading="lazy"
      />
    );
  }

  return <span className="text-base leading-none select-none">{icon || '⚡'}</span>;
};
