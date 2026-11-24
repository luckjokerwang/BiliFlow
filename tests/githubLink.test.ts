import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GITHUB_REPO_URL } from '../src/constants';
import { OptionsHeader } from '../src/entrypoints/options/components/OptionsHeader';

describe('GitHub Repository Integration', () => {
  it('should define GITHUB_REPO_URL pointing to the official BiliFlow repository', () => {
    expect(GITHUB_REPO_URL).toBe('https://github.com/luckjokerwang/BiliFlow');
  });

  describe('OptionsHeader', () => {
    it('should render a GitHub repository link with target="_blank" and rel="noopener noreferrer"', () => {
      const html = renderToString(
        React.createElement(OptionsHeader, {
          isDark: true,
          onToggleTheme: vi.fn(),
          savedToast: null,
        })
      );

      expect(html).toContain('href="https://github.com/luckjokerwang/BiliFlow"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('title="GitHub 开源项目 · 欢迎 Star 与提交反馈 / Issue"');
    });

    it('should adapt styling to dark and light modes correctly', () => {
      const darkHtml = renderToString(
        React.createElement(OptionsHeader, {
          isDark: true,
          onToggleTheme: vi.fn(),
          savedToast: null,
        })
      );
      expect(darkHtml).toContain('bg-slate-800/80');

      const lightHtml = renderToString(
        React.createElement(OptionsHeader, {
          isDark: false,
          onToggleTheme: vi.fn(),
          savedToast: null,
        })
      );
      expect(lightHtml).toContain('bg-slate-100/80');
    });

    it('should render toast notification when savedToast is provided', () => {
      const html = renderToString(
        React.createElement(OptionsHeader, {
          isDark: true,
          onToggleTheme: vi.fn(),
          savedToast: '配置已更新',
        })
      );

      expect(html).toContain('配置已更新');
    });
  });
});
