import { describe, it, expect, beforeEach } from 'vitest';
import { FOCUSABLE_SELECTOR } from '../src/utils/focusable';

describe('FOCUSABLE_SELECTOR', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');

    // Enabled elements — should be focusable
    const enabledButton = document.createElement('button');
    enabledButton.textContent = 'Click me';
    enabledButton.dataset.testid = 'enabled-button';

    const enabledInput = document.createElement('input');
    enabledInput.type = 'text';
    enabledInput.dataset.testid = 'enabled-input';

    const anchor = document.createElement('a');
    anchor.href = 'https://example.com';
    anchor.textContent = 'Link';
    anchor.dataset.testid = 'anchor';

    const enabledSelect = document.createElement('select');
    enabledSelect.dataset.testid = 'enabled-select';

    // Disabled elements — should NOT be focusable
    const disabledButton = document.createElement('button');
    disabledButton.textContent = 'Disabled button';
    disabledButton.disabled = true;
    disabledButton.dataset.testid = 'disabled-button';

    const disabledInput = document.createElement('input');
    disabledInput.type = 'text';
    disabledInput.disabled = true;
    disabledInput.dataset.testid = 'disabled-input';

    const disabledSelect = document.createElement('select');
    disabledSelect.disabled = true;
    disabledSelect.dataset.testid = 'disabled-select';

    container.append(
      enabledButton,
      disabledButton,
      enabledInput,
      disabledInput,
      anchor,
      enabledSelect,
      disabledSelect,
    );
  });

  it('returns enabled interactive elements', () => {
    const results = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const testIds = results.map((el) => (el as HTMLElement).dataset.testid);

    expect(testIds).toContain('enabled-button');
    expect(testIds).toContain('enabled-input');
    expect(testIds).toContain('anchor');
    expect(testIds).toContain('enabled-select');
  });

  it('excludes disabled buttons', () => {
    const results = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const testIds = results.map((el) => (el as HTMLElement).dataset.testid);

    expect(testIds).not.toContain('disabled-button');
  });

  it('excludes disabled inputs', () => {
    const results = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const testIds = results.map((el) => (el as HTMLElement).dataset.testid);

    expect(testIds).not.toContain('disabled-input');
  });

  it('excludes disabled select elements', () => {
    const results = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const testIds = results.map((el) => (el as HTMLElement).dataset.testid);

    expect(testIds).not.toContain('disabled-select');
  });

  it('includes elements with a positive tabindex', () => {
    const div = document.createElement('div');
    div.tabIndex = 0;
    div.dataset.testid = 'tabindex-div';
    container.appendChild(div);

    const results = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const testIds = results.map((el) => (el as HTMLElement).dataset.testid);

    expect(testIds).toContain('tabindex-div');
  });

  it('excludes elements with tabindex="-1"', () => {
    const div = document.createElement('div');
    div.tabIndex = -1;
    div.dataset.testid = 'negative-tabindex-div';
    container.appendChild(div);

    const results = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const testIds = results.map((el) => (el as HTMLElement).dataset.testid);

    expect(testIds).not.toContain('negative-tabindex-div');
  });

  it('excludes anchors without href', () => {
    const anchorNoHref = document.createElement('a');
    anchorNoHref.textContent = 'No href';
    anchorNoHref.dataset.testid = 'anchor-no-href';
    container.appendChild(anchorNoHref);

    const results = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const testIds = results.map((el) => (el as HTMLElement).dataset.testid);

    expect(testIds).not.toContain('anchor-no-href');
  });
});
