import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// @testing-library/svelte doesn't auto-clean without vitest globals, so do it here.
afterEach(() => cleanup());
